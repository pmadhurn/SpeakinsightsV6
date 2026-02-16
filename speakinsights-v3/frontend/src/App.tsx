/**
 * SpeakInsights v3 — App Root (FINAL)
 *
 * Wires together:
 *  • React Router routes (9 pages)
 *  • GlassNavbar (hidden during active meeting)
 *  • Animated background orbs ("Frosted Aurora" design)
 *  • Toast notification provider
 *  • Lazy-loaded route components via React Suspense
 */

import { Suspense, lazy } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import GlassNavbar from '@/components/ui/GlassNavbar';
import Loader from '@/components/ui/Loader';

// Lazy-load pages for better initial bundle size
const Landing = lazy(() => import('@/pages/Landing'));
const CreateMeeting = lazy(() => import('@/pages/CreateMeeting'));
const JoinMeeting = lazy(() => import('@/pages/JoinMeeting'));
const MeetingRoom = lazy(() => import('@/pages/MeetingRoom'));
const History = lazy(() => import('@/pages/History'));
const MeetingReview = lazy(() => import('@/pages/MeetingReview'));
const AIChat = lazy(() => import('@/pages/AIChat'));
const ModelManager = lazy(() => import('@/pages/ModelManager'));
const Settings = lazy(() => import('@/pages/Settings'));

export default function App() {
  const location = useLocation();

  // Hide navbar during active meeting room (not review page)
  const isInMeeting = /^\/meeting\/[^/]+$/.test(location.pathname);

  return (
    <>
      {/* ── Animated background orbs (Frosted Aurora) ── */}
      <div className="orb orb-1" aria-hidden="true" />
      <div className="orb orb-2" aria-hidden="true" />
      <div className="orb orb-3" aria-hidden="true" />

      {/* ── Navigation (hidden during meetings for immersive UX) ── */}
      {!isInMeeting && <GlassNavbar />}

      {/* ── Page Routes with Suspense fallback ── */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <Loader size="lg" text="Loading…" />
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/create" element={<CreateMeeting />} />
          <Route path="/join/:code" element={<JoinMeeting />} />
          <Route path="/meeting/:id" element={<MeetingRoom />} />
          <Route path="/history" element={<History />} />
          <Route path="/meeting/:id/review" element={<MeetingReview />} />
          <Route path="/chat" element={<AIChat />} />
          <Route path="/models" element={<ModelManager />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Suspense>

      {/* ── Toast notifications (top-right, glass-styled) ── */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(30, 41, 59, 0.85)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            color: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#22D3EE', secondary: '#0F172A' },
          },
          error: {
            iconTheme: { primary: '#EF4444', secondary: '#0F172A' },
          },
        }}
      />
    </>
  );
}
