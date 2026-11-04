"""
SpeakInsights v3 — Authentication Core (Clerk JWT)

Verifies Clerk-issued session JWTs from the browser's `Authorization:
Bearer <token>` header against Clerk's JWKS endpoint, then syncs the user
into the local `users` table.

Configuration (in .env):
    CLERK_PUBLISHABLE_KEY=pk_test_...      (frontend uses this)
    CLERK_SECRET_KEY=sk_test_...           (backend uses this)

Clerk's JWKS URL is derived from the frontend API domain embedded in the
publishable key, so no extra config is needed beyond the two keys.
"""

import base64
import logging
import time
from dataclasses import dataclass
from typing import Any

import httpx
from jose import JWTError, jwt
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_db
from app.config import settings
from app.models.user import User

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Clerk helpers
# ---------------------------------------------------------------------------

_JWKS_CACHE_TTL_SECONDS = 3600
_jwks_cache: dict | None = None
_jwks_cache_at: float = 0.0


def _clerk_issuer_from_publishable_key(publishable_key: str) -> str:
    """Decode Clerk's publishable key (pk_*) to derive the API issuer URL.

    Keys look like: pk_test_aGludC1nZW50bHktMjEuY2xlcmsuYWNjb3VudHMuZGV2JA
    The base64 part after 'pk_test_' (and up to a trailing '$') encodes the
    Frontend API domain.
    """
    raw = publishable_key
    if raw.startswith("pk_test_"):
        raw = raw[len("pk_test_"):]
    elif raw.startswith("pk_live_"):
        raw = raw[len("pk_live_"):]
    else:
        raise ValueError(f"Not a Clerk publishable key: {publishable_key!r}")

    # Trailing '$' signals no suffix beyond the domain
    if raw.endswith("$"):
        raw = raw[:-1]

    decoded = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)).decode()
    return f"https://{decoded}"


def _get_clerk_issuer_url() -> str | None:
    """Get the Clerk issuer URL (or None if auth is not configured)."""
    pk = settings.CLERK_PUBLISHABLE_KEY
    if not pk:
        return None
    if settings.CLERK_ISSUER:
        return settings.CLERK_ISSUER
    try:
        return _clerk_issuer_from_publishable_key(pk)
    except Exception as exc:
        logger.warning("Could not decode Clerk publishable key: %s", exc)
        return None


async def _get_jwks() -> dict:
    """Fetch (cached) Clerk's JSON Web Key Set."""
    global _jwks_cache, _jwks_cache_at
    issuer = _get_clerk_issuer_url()
    if not issuer:
        return None
    now = time.monotonic()
    if _jwks_cache and (now - _jwks_cache_at) < _JWKS_CACHE_TTL_SECONDS:
        return _jwks_cache
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{issuer}/.well-known/jwks.json")
        resp.raise_for_status()
        _jwks_cache = resp.json()
        _jwks_cache_at = now
    return _jwks_cache


# ---------------------------------------------------------------------------
# Credential parsing / user sync
# ---------------------------------------------------------------------------

@dataclass
class ClerkUser:
    """Raw Clerk token claims, pre-DB-sync."""
    clerk_id: str
    email: str | None
    name: str | None
    avatar_url: str | None
    claims: dict


async def _verify_clerk_token(token: str) -> ClerkUser:
    """Validate a Clerk-issued JWT against Clerk's JWKS."""
    issuer = _get_clerk_issuer_url()
    if not issuer:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication configured on client but CLERK_PUBLISHABLE_KEY not set server-side",
        )

    jwks = await _get_jwks()
    if not jwks:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Clerk JWKS fetch failed",
        )

    try:
        unverified = jwt.get_unverified_header(token)
        kid = unverified.get("kid")
        key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
        if not key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unknown signing key (kid mismatch)",
            )

        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=issuer,
            options=None,
            audience=None,  # Clerk production JWTs carry `aud`; session tokens are per-front-api
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
        )

    clerk_id = payload.get("sub")
    if not clerk_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
        )

    # Email and name live in separately-encrypted claims; try common fallbacks
    email = payload.get("email") or payload.get("email_address")
    name = payload.get("name") or payload.get("username") or payload.get("display_name")
    avatar_url = payload.get("image_url") or payload.get("avatar_url")

    return ClerkUser(
        clerk_id=clerk_id,
        email=email,
        name=name,
        avatar_url=avatar_url,
        claims=payload,
    )


async def _sync_user(db: AsyncSession, clerk_user: ClerkUser):
    """Find or create the local user row for a Clerk identity."""
    result = await db.execute(
        select(User).where(User.clerk_id == clerk_user.clerk_id)
    )
    user = result.scalar_one_or_none()
    if user is None:
        user = User(
            clerk_id=clerk_user.clerk_id,
            email=clerk_user.email,
            display_name=clerk_user.name,
            avatar_url=clerk_user.avatar_url,
        )
        db.add(user)
        await db.flush()
        logger.info("Created new user row for clerk_id=%s", clerk_user.clerk_id)
    else:
        # Refresh display data if Clerk has more up-to-date info
        if clerk_user.name and user.display_name != clerk_user.name:
            user.display_name = clerk_user.name
        if clerk_user.email and user.email != clerk_user.email:
            user.email = clerk_user.email
        await db.flush()
    return user


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------

async def get_optional_user(
    authorization: str | None = Header(None),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Dependency: resolve the current Clerk user if a token is present.

    Returns (user, clerk_claims) tuple or (None, None).
    Use this on public endpoints that want to personalize when logged in.

    Demo mode: when AUTH_ENABLED=false (or Clerk keys are missing), any
    Authorization header is ignored and the caller stays anonymous.
    """
    if not settings.AUTH_ENABLED or not auth_is_configured():
        return None, None
    if not authorization or not authorization.startswith("Bearer "):
        return None, None
    token = authorization[len("Bearer "):]
    try:
        clerk_user = await _verify_clerk_token(token)
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Auth error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    user = await _sync_user(db, clerk_user)
    return user, clerk_user


async def get_current_user(
    user_tuple: tuple = Depends(get_optional_user),
) -> Any:
    """Dependency: require an authenticated Clerk user.

    Raises 401 if no valid token was provided. Returns the app User row.
    """
    user, _clerk_claims = user_tuple
    # `get_optional_user` returns None for missing/invalid token; requiring
    # auth means raising here.
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return user


def auth_is_configured() -> bool:
    """True when Clerk env vars are set; used by health checks and dev shims."""
    return bool(settings.CLERK_PUBLISHABLE_KEY and settings.CLERK_SECRET_KEY)
