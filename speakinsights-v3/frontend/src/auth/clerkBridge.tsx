/**
 * SpeakInsights v3 — Clerk auth wiring
 *
 * Exposes whether auth is configured and small components that bridge
 * Clerk state into the non-React axios layer and the app shell UI.
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, UserButton, SignInButton, SignOutButton } from '@clerk/react';
import { setApiAuthToken, getApiAuthToken } from '@/services/authToken';

export const clerkAuthEnabled =
  !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

/**
 * Mount near the app root (inside ClerkProvider). Keeps the axios client
 * holding a fresh Clerk session token.
 */
export function AuthBridge() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isSignedIn) {
      if (getApiAuthToken()) setApiAuthToken(null);
      return;
    }
    let cancelled = false;
    const push = async () => {
      try {
        const token = await getToken();
        if (!cancelled) setApiAuthToken(token);
      } catch {
        if (!cancelled) setApiAuthToken(null);
      }
    };
    void push();
    // Refresh each minute so an expiring token is replaced before requests fail
    const interval = window.setInterval(push, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [getToken, isSignedIn]);

  return null;
}

/**
 * Navbar auth controls.
 *
 * Signed in: avatar (profile menu) + an explicit "Log out" button.
 * Signed out: "Log in" (opens Clerk modal) + "Sign up" link to /sign-up.
 */
export function NavbarAuth() {
  if (!clerkAuthEnabled) return null;

  return (
    <div className="flex items-center gap-2">
      <AuthState />
    </div>
  );
}

function AuthState() {
  const { isSignedIn } = useAuth();

  if (isSignedIn) {
    return (
      <>
        <UserButton
          appearance={{
            elements: {
              avatarBox: 'w-9 h-9 rounded-xl shadow-lg ring-1 ring-white/20',
            },
          }}
        />
        <SignOutButton redirectUrl="/">
          <button
            className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] bg-white/5 border border-white/10 text-white/60 hover:text-red-300 hover:border-red-400/30 hover:bg-red-500/10 transition-colors"
            title="Log out of SpeakInsights"
          >
            Log out
          </button>
        </SignOutButton>
      </>
    );
  }

  return (
    <>
      <SignInButton mode="modal">
        <button className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-400/30 text-cyan-300 hover:text-cyan-200 hover:border-cyan-300/50 transition-colors">
          Log in
        </button>
      </SignInButton>
      <Link
        to="/sign-up"
        className="hidden sm:block px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] border border-white/10 text-white/50 hover:text-white hover:bg-white/5 transition-colors"
      >
        Sign up
      </Link>
    </>
  );
}
