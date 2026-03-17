import Link from 'next/link'

const features = [
  {
    icon: '✦',
    title: 'WYSIWYG Editor',
    desc: 'Rich text editing powered by TipTap — full formatting, media embeds, and real-time preview built in.',
  },
  {
    icon: '◈',
    title: 'Role-Based Access',
    desc: 'Admin and Author roles with Supabase RLS enforcing security at the database level. Zero-trust by default.',
  },
  {
    icon: '◎',
    title: 'Draft & Publish',
    desc: 'Full editorial workflow with draft, review, and publish states so your team can collaborate flawlessly.',
  },
  {
    icon: '⬡',
    title: 'App Router Native',
    desc: 'Built on Next.js 15 App Router with server components, streaming, and edge-ready architecture.',
  },
  {
    icon: '◇',
    title: 'Supabase Backend',
    desc: 'Postgres database with real-time capabilities, auth, and storage — all managed through Supabase.',
  },
  {
    icon: '❋',
    title: 'Fully Open',
    desc: 'Customizable and extensible. Own your data, your code, your content — no lock-in, ever.',
  },
]

const stack = [
  { label: 'Framework', value: 'Next.js 15' },
  { label: 'Database', value: 'Supabase' },
  { label: 'Styling', value: 'Tailwind CSS' },
  { label: 'Editor', value: 'TipTap' },
]

export default function Home() {
  return (
    <div className="landing-root">
      {/* Ambient glow */}
      <div className="ambient-glow" aria-hidden />

      {/* ── Navigation ── */}
      <nav className="landing-nav">
        <div className="nav-inner">
          <span className="nav-logo">
            <span className="accent">✦</span> Blog
          </span>
          <div className="nav-links">
            <Link href="/blog" className="nav-link-ghost">Blog</Link>
            <Link href="/dashboard" className="nav-link-solid">Dashboard →</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="hero-section">
        <div className="hero-inner">
          <div className="hero-badge">
            <span className="badge-dot" aria-hidden />
            <span>Modern Publishing Platform</span>
          </div>

          <h1 className="hero-headline">
            <span className="headline-line">Write.</span>
            <span className="headline-line headline-shimmer">Publish.</span>
            <span className="headline-line">Inspire.</span>
          </h1>

          <p className="hero-body">
            A full-stack Blog CMS built for modern teams. Draft, edit, and publish
            with a powerful WYSIWYG editor, role-based access control, and a
            Supabase-powered backend.
          </p>

          <div className="hero-actions">
            <Link href="/blog" className="btn-primary">
              Read the Blog <span aria-hidden>→</span>
            </Link>
            <Link href="/dashboard" className="btn-outline">
              Open Dashboard
            </Link>
          </div>
        </div>

        {/* Decorative oversized quote */}
        <div className="deco-quote" aria-hidden>&ldquo;</div>
      </section>

      {/* ── Stack bar ── */}
      <section className="stack-bar">
        <div className="stack-inner">
          {stack.map((item, i) => (
            <div key={i} className={`stack-item${i < stack.length - 1 ? ' stack-item--border' : ''}`}>
              <div className="stack-label">{item.label}</div>
              <div className="stack-value">{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="features-section">
        <div className="features-inner">
          <div className="section-eyebrow">Features</div>
          <h2 className="section-headline">
            Everything you need<br className="br-desktop" /> to publish brilliantly.
          </h2>
        </div>

        <div className="features-grid">
          {features.map((feature, i) => (
            <div key={i} className="feature-card">
              <div className="feature-icon" aria-hidden>{feature.icon}</div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-desc">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="cta-section">
        <div className="cta-pattern" aria-hidden />
        <h2 className="cta-headline">Start writing today.</h2>
        <p className="cta-body">
          Jump into the dashboard and begin crafting your first post in minutes.
        </p>
        <Link href="/dashboard" className="btn-dark">
          Open Dashboard →
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <span className="nav-logo footer-logo">
            <span className="accent">✦</span> Blog
          </span>
          <p className="footer-copy">© {new Date().getFullYear()} Blog CMS. Built with Next.js &amp; Supabase.</p>
          <div className="footer-links">
            <Link href="/blog" className="footer-link">Blog</Link>
            <Link href="/dashboard" className="footer-link">Dashboard</Link>
          </div>
        </div>
      </footer>

      <style>{`
        /* ── Reset & root ── */
        .landing-root {
          background-color: #080808;
          color: #f0ece4;
          font-family: var(--font-dm-sans, sans-serif);
          min-height: 100vh;
          position: relative;
          overflow-x: hidden;
        }

        /* ── Ambient glow ── */
        .ambient-glow {
          position: fixed;
          top: -15%;
          left: 25%;
          width: min(700px, 100vw);
          height: min(700px, 100vw);
          background: radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 65%);
          pointer-events: none;
          z-index: 0;
        }

        /* ── Accent ── */
        .accent { color: #f59e0b; }

        /* ── Nav ── */
        .landing-nav {
          position: relative;
          z-index: 10;
        }
        .nav-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .nav-logo {
          font-family: var(--font-playfair, serif);
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #f0ece4;
        }
        .nav-links {
          display: flex;
          align-items: center;
          gap: 28px;
        }
        .nav-link-ghost {
          font-size: 12px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #6b6560;
          text-decoration: none;
          transition: color 0.2s;
        }
        .nav-link-ghost:hover { color: #f0ece4; }
        .nav-link-solid {
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #080808;
          background-color: #f0ece4;
          padding: 10px 22px;
          text-decoration: none;
          font-weight: 700;
          transition: background-color 0.2s;
        }
        .nav-link-solid:hover { background-color: #f59e0b; }

        /* ── Hero ── */
        .hero-section {
          position: relative;
          z-index: 2;
          max-width: 1200px;
          margin: 0 auto;
          padding: 80px 32px 120px;
        }
        .hero-inner { max-width: 700px; }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 40px;
          padding: 6px 14px;
          border: 1px solid rgba(245,158,11,0.35);
        }
        .badge-dot {
          width: 6px;
          height: 6px;
          background-color: #f59e0b;
          border-radius: 50%;
          display: block;
          flex-shrink: 0;
        }
        .hero-badge span:last-child {
          font-size: 11px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #f59e0b;
        }

        .hero-headline {
          font-family: var(--font-playfair, serif);
          font-size: clamp(52px, 9vw, 112px);
          font-weight: 700;
          line-height: 1.0;
          letter-spacing: -0.04em;
          margin: 0 0 32px;
          color: #f0ece4;
        }
        .headline-line { display: block; }
        .headline-shimmer {
          background-image: linear-gradient(90deg, #f59e0b 0%, #fde68a 40%, #f59e0b 80%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }

        .hero-body {
          font-size: 18px;
          line-height: 1.75;
          color: #6b6560;
          margin: 0 0 40px;
          max-width: 540px;
        }

        .hero-actions {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
        }

        .btn-primary {
          padding: 14px 32px;
          background-color: #f59e0b;
          color: #080808;
          text-decoration: none;
          font-weight: 700;
          font-size: 14px;
          letter-spacing: 0.04em;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: background-color 0.2s, transform 0.15s;
        }
        .btn-primary:hover {
          background-color: #fbbf24;
          transform: translateY(-1px);
        }

        .btn-outline {
          padding: 14px 32px;
          border: 1px solid rgba(240,236,228,0.2);
          color: #f0ece4;
          text-decoration: none;
          font-weight: 500;
          font-size: 14px;
          letter-spacing: 0.04em;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: border-color 0.2s, color 0.2s;
        }
        .btn-outline:hover {
          border-color: rgba(240,236,228,0.5);
          color: #fff;
        }

        .deco-quote {
          position: absolute;
          top: 20px;
          right: 40px;
          font-family: var(--font-playfair, serif);
          font-size: clamp(200px, 28vw, 420px);
          color: rgba(245,158,11,0.035);
          line-height: 1;
          user-select: none;
          pointer-events: none;
          font-weight: 700;
        }

        /* ── Stack bar ── */
        .stack-bar {
          position: relative;
          z-index: 2;
          border-top: 1px solid rgba(240,236,228,0.07);
          border-bottom: 1px solid rgba(240,236,228,0.07);
        }
        .stack-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
        }
        .stack-item {
          padding: 28px 32px;
        }
        .stack-item--border {
          border-right: 1px solid rgba(240,236,228,0.07);
        }
        .stack-label {
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #4a4540;
          margin-bottom: 8px;
        }
        .stack-value {
          font-family: var(--font-playfair, serif);
          font-size: 20px;
          font-weight: 600;
          color: #f0ece4;
        }

        /* ── Features ── */
        .features-section {
          position: relative;
          z-index: 2;
          max-width: 1200px;
          margin: 0 auto;
          padding: 100px 32px;
        }
        .features-inner {
          margin-bottom: 56px;
        }
        .section-eyebrow {
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #f59e0b;
          margin-bottom: 16px;
        }
        .section-headline {
          font-family: var(--font-playfair, serif);
          font-size: clamp(30px, 4.5vw, 52px);
          font-weight: 700;
          letter-spacing: -0.03em;
          color: #f0ece4;
          margin: 0;
          line-height: 1.1;
        }
        .br-desktop { display: block; }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background-color: rgba(240,236,228,0.06);
          border: 1px solid rgba(240,236,228,0.06);
        }
        .feature-card {
          padding: 40px;
          background-color: #080808;
          transition: background-color 0.3s;
        }
        .feature-card:hover { background-color: #0e0d0c; }
        .feature-icon {
          font-size: 22px;
          color: #f59e0b;
          margin-bottom: 20px;
          font-family: monospace;
        }
        .feature-title {
          font-family: var(--font-playfair, serif);
          font-size: 19px;
          font-weight: 600;
          color: #f0ece4;
          margin: 0 0 12px;
          letter-spacing: -0.01em;
        }
        .feature-desc {
          font-size: 14px;
          line-height: 1.75;
          color: #4a4540;
          margin: 0;
        }

        /* ── CTA ── */
        .cta-section {
          position: relative;
          z-index: 2;
          background-color: #f0ece4;
          margin: 0 32px 80px;
          padding: 72px 48px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          overflow: hidden;
        }
        .cta-pattern {
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(
            45deg,
            rgba(8,8,8,0.03) 0px,
            rgba(8,8,8,0.03) 1px,
            transparent 1px,
            transparent 22px
          );
          pointer-events: none;
        }
        .cta-headline {
          font-family: var(--font-playfair, serif);
          font-size: clamp(28px, 5vw, 52px);
          font-weight: 700;
          color: #080808;
          letter-spacing: -0.03em;
          line-height: 1.1;
          margin: 0 0 20px;
          position: relative;
          z-index: 1;
        }
        .cta-body {
          font-size: 16px;
          color: #6b6560;
          margin: 0 0 40px;
          max-width: 420px;
          line-height: 1.65;
          position: relative;
          z-index: 1;
        }
        .btn-dark {
          position: relative;
          z-index: 1;
          padding: 16px 40px;
          background-color: #080808;
          color: #f0ece4;
          text-decoration: none;
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: background-color 0.2s, transform 0.15s;
        }
        .btn-dark:hover {
          background-color: #1a1a1a;
          transform: translateY(-1px);
        }

        /* ── Footer ── */
        .landing-footer {
          position: relative;
          z-index: 2;
          border-top: 1px solid rgba(240,236,228,0.06);
        }
        .footer-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .footer-logo { color: #4a4540; font-size: 15px; }
        .footer-copy { font-size: 12px; color: #2e2c2a; margin: 0; }
        .footer-links { display: flex; gap: 24px; }
        .footer-link {
          font-size: 12px;
          color: #4a4540;
          text-decoration: none;
          transition: color 0.2s;
        }
        .footer-link:hover { color: #f0ece4; }

        /* ── Animations ── */
        @keyframes shimmer {
          0%   { background-position: 0%   center; }
          100% { background-position: 200% center; }
        }

        /* ── Tablet (≤ 900px) ── */
        @media (max-width: 900px) {
          .nav-inner { padding: 20px 24px; }
          .hero-section { padding: 60px 24px 90px; }
          .deco-quote { display: none; }
          .features-section { padding: 72px 24px; }
          .features-grid { grid-template-columns: repeat(2, 1fr); }
          .stack-inner { grid-template-columns: repeat(2, 1fr); }
          .stack-item--border:nth-child(2) { border-right: none; }
          .stack-item:nth-child(1),
          .stack-item:nth-child(2) {
            border-bottom: 1px solid rgba(240,236,228,0.07);
          }
          .cta-section { margin: 0 24px 64px; padding: 56px 32px; }
          .footer-inner { flex-direction: column; text-align: center; gap: 12px; }
          .br-desktop { display: none; }
        }

        /* ── Mobile (≤ 600px) ── */
        @media (max-width: 600px) {
          .nav-inner { padding: 18px 20px; }
          .nav-link-ghost { display: none; }
          .hero-section { padding: 48px 20px 72px; }
          .hero-body { font-size: 16px; }
          .hero-actions { flex-direction: column; }
          .btn-primary, .btn-outline { width: 100%; justify-content: center; }
          .features-grid { grid-template-columns: 1fr; }
          .features-section { padding: 56px 20px; }
          .stack-inner {
            grid-template-columns: 1fr 1fr;
            padding: 0 0;
          }
          .stack-item { padding: 20px 20px; }
          .cta-section { margin: 0 20px 56px; padding: 48px 24px; }
          .footer-inner { padding: 24px 20px; }
          .footer-links { gap: 16px; }
          .hero-badge { margin-bottom: 28px; }
        }
      `}</style>
    </div>
  )
}
