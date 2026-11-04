# SpeakInsights v3 — Upgrade Roadmap

This plan grows SpeakInsights from a shared demo video-meeting platform into a real
multi-user product. Work is split into phases; each phase is independently shippable.

| Phase | Feature | Why first | Key touchpoints |
|---|---|---|---|
| **1 (now)** | **Authentication & multi-user** | Everything else (analytics, per-user data, sharing) needs real users | FastAPI JWT middleware, React ClerkProvider |
| **2** | Analytics dashboard | Data already stored; shortest high-value win | New `/api/analytics`, new Dashboard page |
| **3** | Speaker diarization upgrade | Fix speaker labels quality | `whisperx_client.py`, post-processing |
| **4** | Exports (PDF/XLSX/SRT) + notifications | Workflow polish | New export routes |
| **5** | Integrations (Slack/Teams, webhooks, email digest) | Distribution | New services + config |
| **6** | Cloud deployment & scale | Take it live | Docker/Podman remote, LoadKit cloud LiveKit |

## Phase 1 — Authentication (current work)

### Decisions
- **Auth provider: Clerk.** Handles login UI, sessions, and JWT issuance; we only
  verify tokens server-side. Avoids building user management from scratch.
- **Strategy: opt-in-but-wired.** All API routes gain a `CurrentUser` dependency; the
  meeting/summary/chat endpoints use it to scope data per user. Existing public access
  flow (room code + host approval) stays for guests.

### Backend work
1. Add `clerk_backend_api` (and `python-jose`/`pyjwt`) to `backend/requirements.txt`.
2. `app/core/auth.py`:
   - `verify_clerk_token(bearer) -> ClerkUser` — validates JWT against Clerk's
     JWKS endpoint, extracts `sub`, `email`, `name`.
   - Optional dependency `get_current_user` — `401` when missing/invalid, returns
     `None` in public endpoints.
3. `app/models/user.py` — `User` table (id, clerk_id unique, email, name,
   created_at), FKs from `Meeting.host_user` etc.
4. Protect mutating routes (`POST /meetings`, joins, approvals, chats, summaries)
   with `get_current_user`; scope read routes by meeting membership.
5. Alembic-less migration via `Base.metadata.create_all` plus a small backfill for
   existing rows (`host_user_id = NULL` allowed as guest-hosted).

### Frontend work
1. `npm i @clerk/clerk-react@latest` in `frontend`.
2. Wrap `App.tsx` in `<ClerkProvider>`.
3. `<SignedIn>` gate on App shell; `<SignIn>` / `<SignUp>` pages at `/sign-in`,
   `/sign-up`.
4. `services/api.ts` — attach `Authorization: Bearer <clerk jwt>` to every fetch and
   the WebSocket upgrade.
5. CreateMeeting / History / AIChat get a user menu (UserButton) in the header.

### Verification
- `python -m compileall` + import check on backend.
- `tsc --noEmit` (or vite build) on frontend.
- Manual: signed-out → SignIn → create meeting shows user; guest join in another
  browser profile still works.

## Phase 2 — Analytics dashboard (next up)
- `/api/analytics/overview`: meetings/wk, total talk time, top participants,
  sentiment trend, task completion rate (queries over existing tables).
- Frontend: `/dashboard` route with recharts (already in stack? verify — else use
  lightweight SVG charts).
