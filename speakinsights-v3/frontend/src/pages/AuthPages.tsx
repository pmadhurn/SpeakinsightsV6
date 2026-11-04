/**
 * SpeakInsights v3 — Clerk auth pages (custom glass design)
 *
 * Split-screen layout: branding panel on the left, Clerk card on the right.
 * Clerk components are themed via `appearance` so the built-in UI matches
 * the app's dark glass aesthetic — no external theme package needed.
 * Custom login stays simple: Clerk owns the flows, we own the look.
 */
import type { CSSProperties } from 'react';
import { SignIn, SignUp as ClerkSignUp } from '@clerk/react';

/* ── Clerk theming: match Frosted Aurora ─────────────────────────────── */

const clerkAppearance = {
  variables: {
    colorPrimary: '#22D3EE',
    colorBackground: 'transparent',
    colorInputBackground: 'rgba(255, 255, 255, 0.05)',
    colorInputText: 'rgba(255, 255, 255, 0.95)',
    colorText: 'rgba(255, 255, 255, 0.9)',
    colorTextSecondary: 'rgba(255, 255, 255, 0.5)',
    colorDanger: '#EF4444',
    colorSuccess: '#34D399',
    colorAlphaShade: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '0.75rem',
    fontFamily: 'inherit',
    fontWeight: { bold: 700, semibold: 600, normal: 400 },
  },
  elements: {
    rootBox: 'w-full',
    card: 'bg-transparent shadow-none border-0',
    headerTitle: 'text-white/90 text-xl font-black tracking-tight',
    headerSubtitle: 'text-white/45 text-xs',
    socialButtonsBlockButton:
      'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-colors',
    formButtonPrimary:
      'bg-gradient-to-r from-cyan-500/40 to-blue-500/40 text-white font-black uppercase tracking-widest text-xs hover:from-cyan-500/60 hover:to-blue-500/60 shadow-[0_0_20px_rgba(34,211,238,0.15)] transition-all',
    formFieldInput:
      'bg-white/[0.05] border border-white/10 text-white text-sm focus:border-cyan-400/40 focus:ring-0',
    formFieldLabel: 'text-white/50 text-[10px] font-black uppercase tracking-widest',
    footerActionLink: 'text-cyan-400 hover:text-cyan-300',
    identityPreviewText: 'text-white/80',
    dividerLine: 'bg-white/10',
    dividerText: 'text-white/30 text-[10px] uppercase tracking-widest',
    otpCodeFieldInput: 'bg-white/[0.05] border border-white/10 text-white',
  },
};

/* ── Page layout ─────────────────────────────────────────────────────── */

export function SignInPage() {
  return (
    <AuthLayout subtitle="Welcome back. Sign in to reach your meetings, transcripts and AI insights.">
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        forceRedirectUrl="/"
        appearance={clerkAppearance}
      />
    </AuthLayout>
  );
}

export function SignUpPage() {
  return (
    <AuthLayout subtitle="One minute to create. Lifetime of searchable, summarized meetings.">
      <ClerkSignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        forceRedirectUrl="/"
        appearance={clerkAppearance}
      />
    </AuthLayout>
  );
}

const FEATURES: { title: string; desc: string }[] = [
  {
    title: 'Private by design',
    desc: 'Transcripts, summaries and recordings stay on your own metal.',
  },
  {
    title: 'Instant AI insights',
    desc: 'Action items, sentiment and summaries — the moment the meeting ends.',
  },
  {
    title: 'Chat with every meeting',
    desc: 'Ask any past conversation a question and get a sourced answer.',
  },
];

function AuthLayout({ children, subtitle }: { children: React.ReactNode; subtitle: string }) {
  return (
    <div style={pageStyle}>
      {/* Ambient glow orbs */}
      <div style={orb1Style} aria-hidden="true" />
      <div style={orb2Style} aria-hidden="true" />
      <div style={orb3Style} aria-hidden="true" />

      <div style={splitStyle}>
        {/* Left: branding panel (hidden on small screens) */}
        <div style={brandingStyle}>
          <div style={logoRowStyle}>
            <div style={logoMarkStyle}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            </div>
            <span style={logoTextStyle}>
              Speak<span style={{ color: '#22D3EE' }}>Insights</span>
            </span>
          </div>

          <h2 style={headlineStyle}>
            Own every<br />conversation.
          </h2>

          <div style={featureListStyle}>
            {FEATURES.map((f) => (
              <div key={f.title} style={featureRowStyle}>
                <span style={featureDotStyle} />
                <div>
                  <p style={featureTitleStyle}>{f.title}</p>
                  <p style={featureDescStyle}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p style={taglineStyle}>Self-hosted meeting intelligence · Air-gapped privacy</p>
        </div>

        {/* Right: Clerk card */}
        <div style={cardStyle}>
          <h1 style={titleStyle}>SpeakInsights</h1>
          <p style={subtitleStyle}>{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────── */

const pageStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  /* clear the fixed glass navbar (≈72px) + breathing room; scrollable when tall */
  minHeight: '100vh',
  padding: '104px 24px 48px',
  position: 'relative',
  overflowX: 'hidden',
};

const splitStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 56,
  position: 'relative',
  zIndex: 1,
  width: '100%',
  maxWidth: 900,
  justifyContent: 'center',
  flexWrap: 'wrap',
};

const brandingStyle: CSSProperties = {
  flex: '1 1 320px',
  maxWidth: 420,
  display: 'flex',
  flexDirection: 'column',
  gap: 28,
};

const cardStyle: CSSProperties = {
  flex: '0 1 420px',
  width: '100%',
  background: 'rgba(15, 23, 42, 0.72)',
  backdropFilter: 'blur(28px)',
  WebkitBackdropFilter: 'blur(28px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 20,
  padding: '28px 24px',
  boxShadow: '0 24px 64px rgba(0, 0, 0, 0.45)',
};

const logoRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const logoMarkStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, #22D3EE, #2563EB)',
  boxShadow: '0 8px 24px rgba(34, 211, 238, 0.3)',
};

const logoTextStyle: CSSProperties = {
  color: 'rgba(255,255,255,0.95)',
  fontSize: 16,
  fontWeight: 800,
  letterSpacing: '-0.01em',
  textTransform: 'uppercase',
};

const headlineStyle: CSSProperties = {
  color: 'rgba(255,255,255,0.95)',
  fontSize: 40,
  lineHeight: 1.05,
  fontWeight: 900,
  letterSpacing: '-0.03em',
  margin: 0,
};

const featureListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

const featureRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
};

const featureDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 9999,
  marginTop: 6,
  background: '#22D3EE',
  boxShadow: '0 0 12px rgba(34, 211, 238, 0.6)',
  flexShrink: 0,
};

const featureTitleStyle: CSSProperties = {
  color: 'rgba(255,255,255,0.85)',
  fontSize: 14,
  fontWeight: 700,
  margin: '0 0 2px',
};

const featureDescStyle: CSSProperties = {
  color: 'rgba(255,255,255,0.45)',
  fontSize: 13,
  margin: 0,
};

const taglineStyle: CSSProperties = {
  color: 'rgba(255,255,255,0.3)',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.15em',
  fontWeight: 700,
  margin: 0,
};

const titleStyle: CSSProperties = {
  color: 'rgba(255, 255, 255, 0.95)',
  fontSize: 22,
  fontWeight: 800,
  textAlign: 'center',
  margin: '4px 0 6px',
  letterSpacing: '-0.02em',
};

const subtitleStyle: CSSProperties = {
  color: 'rgba(255, 255, 255, 0.5)',
  fontSize: 13,
  textAlign: 'center',
  margin: '0 0 20px',
};

/* Ambient glow orbs — echo the app background */
const orbBase: CSSProperties = {
  position: 'absolute',
  borderRadius: 9999,
  filter: 'blur(120px)',
  pointerEvents: 'none',
};

const orb1Style: CSSProperties = { ...orbBase, width: 520, height: 520, top: -160, left: -120, background: 'rgba(34, 211, 238, 0.08)' };
const orb2Style: CSSProperties = { ...orbBase, width: 480, height: 480, bottom: -180, right: -120, background: 'rgba(147, 51, 234, 0.08)' };
const orb3Style: CSSProperties = { ...orbBase, width: 360, height: 360, top: '40%', left: '55%', background: 'rgba(37, 99, 235, 0.07)' };
