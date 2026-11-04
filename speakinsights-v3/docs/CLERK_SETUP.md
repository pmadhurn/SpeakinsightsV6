SpeakInsights v3 — Clerk CLI setup summary (Phase 1)

## What was done
1. CLI linked to existing Dashboard application app_3I8EKfcZHlHuCxlqtmp1re3wY5O
2. `npx -y clerk@latest env pull --print` pulled dev keys
3. `.env` now contains
   - VITE_CLERK_PUBLISHABLE_KEY (frontend)
   - CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY (backend)
4. Manual Clerk provider, SignIn/SignUp pages, and axios token injection already built
   in [UPGRADE_PLAN.md] Phase 1 — this CLI step populated the env keys to make it live.
5. doctor: ✓ all checks; ! production not configured (dev mode only).

## Remaining manual auth controls (already built)
- /sign-in and /sign-up pages (GlassNavbar already uses UserButton / SignInButton)
- signed-in users connected to meetings via host_user_id in backend create_meeting

## localhost verification (dev)
Run `npm install && npm run dev` in the frontend; backend runs its normal dev command.
Frontend reads VITE_CLERK_PUBLISHABLE_KEY from the env; backend reads
CLERK_PUBLISHABLE_KEY/CLERK_SECRET_KEY.
