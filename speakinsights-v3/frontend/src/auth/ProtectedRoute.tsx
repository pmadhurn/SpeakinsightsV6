/**
 * SpeakInsights v3 — Route guard
 *
 * Wraps owner-only pages (/create, /history, /chat, /review, ...).
 * When Clerk is not configured (demo mode) it lets everything through so
 * the public demo still works without keys.
 */
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import Loader from '@/components/ui/Loader';
import { clerkAuthEnabled } from '@/auth/clerkBridge';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const location = useLocation();

  if (!clerkAuthEnabled) return <>{children}</>;

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#02060B]">
        <Loader size="lg" text="Checking your session…" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <Navigate
        to="/sign-in"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return <>{children}</>;
}
