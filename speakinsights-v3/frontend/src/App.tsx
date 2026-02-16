import { Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import GlassNavbar from '@/components/ui/GlassNavbar';

// Pages
import Landing from '@/pages/Landing';
import CreateMeeting from '@/pages/CreateMeeting';
import JoinMeeting from '@/pages/JoinMeeting';
import MeetingRoom from '@/pages/MeetingRoom';
import History from '@/pages/History';
import MeetingReview from '@/pages/MeetingReview';
import AIChat from '@/pages/AIChat';
import ModelManager from '@/pages/ModelManager';
import Settings from '@/pages/Settings';

export default function App() {
  const location = useLocation();
  const isInMeeting = location.pathname.match(/^\/meeting\/[^/]+$/);

  return (
    <>
      {/* Background orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      {/* Navbar (hidden during active meeting) */}
      {!isInMeeting && <GlassNavbar />}

      {/* Routes */}
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

      {/* Toast notifications */}
      <Toaster />
    </>
  );
}
