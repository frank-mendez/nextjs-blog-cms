import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const pillars = [
  {
    num: '01',
    title: 'System Design',
    desc: 'Architecture decisions, trade-offs, and the thinking behind systems that scale and survive production.',
  },
  {
    num: '02',
    title: 'Engineering Craft',
    desc: 'Clean code, testing, debugging strategies, and the fundamentals that separate good engineers from great ones.',
  },
  {
    num: '03',
    title: 'Performance',
    desc: 'Making software faster. Profiling, optimization, and measuring what actually matters at scale.',
  },
  {
    num: '04',
    title: 'Tooling & DX',
    desc: 'The tools, configurations, and workflows that compound over time and make engineers dramatically more productive.',
  },
  {
    num: '05',
    title: 'Career & Growth',
    desc: 'Getting better at the craft over time. Technical leadership, communication, and leveling up deliberately.',
  },
  {
    num: '06',
    title: 'Open Source',
    desc: 'Building, contributing, and maintaining software in the open. What it takes and why it matters.',
  },
]

const stats = [
  { value: 'Deep Dives', label: 'Long-form technical' },
  { value: 'Guides', label: 'Step-by-step practical' },
  { value: 'Architecture', label: 'System design decisions' },
  { value: 'No fluff', label: 'Direct and honest' },
]

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="tpe-root">
      {/* Graph-paper texture overlay */}
      <div className="tpe-texture" aria-hidden />
      {/* Amber glow */}
      <div className="tpe-glow" aria-hidden />

      {/* ── Nav ── */}
      <nav className="tpe-nav">
        <div className="tpe-nav-inner">
          <Link href="/" className="tpe-logo">
            <span className="tpe-logo-accent">✦</span>
            <span className="tpe-logo-text">The Practical Engineer</span>
          </Link>
          <div className="tpe-nav-links">
            <Link href="/blog" className="tpe-nav-ghost">Articles</Link>
            {user ? (
              <Link href="/dashboard" className="tpe-nav-solid">Dashboard →</Link>
            ) : (
              <Link href="/login" className="tpe-nav-solid">Sign In →</Link>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="tpe-hero">
        {/* Vertical rule + issue label */}
        <div className="tpe-issue-label" aria-hidden>
          <span className="tpe-issue-rule" />
          <span className="tpe-issue-text">Engineering Knowledge</span>
        </div>

        <div className="tpe-hero-content">
          <div className="tpe-hero-badge">
            <span className="tpe-badge-pip" aria-hidden />
            <span>Practical · Honest · Opinionated</span>
          </div>

          <h1 className="tpe-hero-title">
            <span className="tpe-title-the">The</span>
            <span className="tpe-title-practical">Practical</span>
            <span className="tpe-title-engineer">Engineer<span className="tpe-title-dot">.</span></span>
          </h1>

          <p className="tpe-hero-sub">
            In-depth technical writing for engineers who care about craft.
            No padding, no filler — just hard-won knowledge from real engineering work.
          </p>

          <div className="tpe-hero-actions">
            <Link href="/blog" className="tpe-btn-primary">
              Read Articles <span aria-hidden>→</span>
            </Link>
            {user ? (
              <Link href="/dashboard" className="tpe-btn-ghost">
                Open Dashboard
              </Link>
            ) : (
              <Link href="/login" className="tpe-btn-ghost">
                Sign In
              </Link>
            )}
          </div>
        </div>

        {/* Decorative large number */}
        <div className="tpe-deco-num" aria-hidden>01</div>
      </section>

      {/* ── Pillars strip ── */}
      <div className="tpe-strip">
        <div className="tpe-strip-inner">
          {stats.map((s, i) => (
            <div key={i} className={`tpe-strip-item${i < stats.length - 1 ? ' tpe-strip-item--sep' : ''}`}>
              <div className="tpe-strip-value">{s.value}</div>
              <div className="tpe-strip-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Topics ── */}
      <section className="tpe-topics">
        <div className="tpe-topics-header">
          <div className="tpe-section-eye">What you&apos;ll find</div>
          <h2 className="tpe-section-title">
            Six pillars of<br className="tpe-br-md" /> practical engineering.
          </h2>
        </div>

        <div className="tpe-topics-grid">
          {pillars.map((p) => (
            <div key={p.num} className="tpe-topic-card">
              <span className="tpe-topic-num">{p.num}</span>
              <h3 className="tpe-topic-title">{p.title}</h3>
              <p className="tpe-topic-desc">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pull quote ── */}
      <section className="tpe-quote-section">
        <div className="tpe-quote-rule" aria-hidden />
        <blockquote className="tpe-quote">
          &ldquo;The goal is not to write about engineering.
          <br className="tpe-br-md" /> The goal is to make you a better engineer.&rdquo;
        </blockquote>
        <div className="tpe-quote-rule" aria-hidden />
      </section>

      {/* ── CTA ── */}
      <section className="tpe-cta">
        <div className="tpe-cta-hatch" aria-hidden />
        <div className="tpe-cta-inner">
          <div className="tpe-section-eye tpe-eye-dark">Start reading</div>
          <h2 className="tpe-cta-title">Engineering insights,<br /> delivered with intent.</h2>
          <p className="tpe-cta-body">
            Every article is written to give you something you can use.
            No fluff, no filler — just knowledge that compounds.
          </p>
          <Link href="/blog" className="tpe-btn-dark">
            Browse All Articles →
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="tpe-footer">
        <div className="tpe-footer-inner">
          <span className="tpe-footer-logo">
            <span className="tpe-logo-accent">✦</span> The Practical Engineer
          </span>
          <p className="tpe-footer-copy">
            © {new Date().getFullYear()} The Practical Engineer. Built with Next.js &amp; Supabase.
          </p>
          <div className="tpe-footer-links">
            <Link href="/blog" className="tpe-footer-link">Articles</Link>
            {user ? (
              <Link href="/dashboard" className="tpe-footer-link">Dashboard</Link>
            ) : (
              <Link href="/login" className="tpe-footer-link">Sign In</Link>
            )}
          </div>
        </div>
      </footer>

      <style>{`
        /* ── Root ── */
        .tpe-root {
          background-color: #070707;
          color: #ede8df;
          font-family: var(--font-dm-sans, sans-serif);
          min-height: 100vh;
          position: relative;
          overflow-x: hidden;
        }

        /* ── Graph-paper texture ── */
        .tpe-texture {
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(245,158,11,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(245,158,11,0.025) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
          z-index: 0;
        }

        /* ── Amber glow ── */
        .tpe-glow {
          position: fixed;
          top: -10%;
          right: -5%;
          width: min(800px, 120vw);
          height: min(800px, 120vw);
          background: radial-gradient(circle at 70% 30%, rgba(245,158,11,0.06) 0%, transparent 60%);
          pointer-events: none;
          z-index: 0;
        }

        /* ── Nav ── */
        .tpe-nav {
          position: relative;
          z-index: 10;
        }
        .tpe-nav-inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 28px 48px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .tpe-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }
        .tpe-logo-accent { color: #f59e0b; font-size: 16px; }
        .tpe-logo-text {
          font-family: var(--font-playfair, serif);
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #ede8df;
        }
        .tpe-nav-links {
          display: flex;
          align-items: center;
          gap: 32px;
        }
        .tpe-nav-ghost {
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #5a5550;
          text-decoration: none;
          transition: color 0.2s;
        }
        .tpe-nav-ghost:hover { color: #ede8df; }
        .tpe-nav-solid {
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          font-weight: 700;
          color: #070707;
          background-color: #ede8df;
          padding: 10px 24px;
          text-decoration: none;
          transition: background-color 0.2s;
        }
        .tpe-nav-solid:hover { background-color: #f59e0b; }

        /* ── Hero ── */
        .tpe-hero {
          position: relative;
          z-index: 2;
          max-width: 1280px;
          margin: 0 auto;
          padding: 80px 48px 120px;
          display: flex;
          align-items: flex-start;
          gap: 48px;
        }

        /* Vertical rule + rotated label */
        .tpe-issue-label {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding-top: 8px;
          flex-shrink: 0;
        }
        .tpe-issue-rule {
          display: block;
          width: 1px;
          height: 80px;
          background: linear-gradient(to bottom, transparent, rgba(245,158,11,0.5));
        }
        .tpe-issue-text {
          font-size: 10px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #3a3530;
          writing-mode: vertical-rl;
          text-orientation: mixed;
        }

        .tpe-hero-content { flex: 1; max-width: 780px; }

        .tpe-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 44px;
          padding: 7px 16px;
          border: 1px solid rgba(245,158,11,0.3);
        }
        .tpe-badge-pip {
          width: 6px; height: 6px;
          background-color: #f59e0b;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .tpe-hero-badge span:last-child {
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #f59e0b;
        }

        /* Title stack */
        .tpe-hero-title {
          margin: 0 0 36px;
          line-height: 0.92;
          letter-spacing: -0.04em;
        }
        .tpe-title-the {
          display: block;
          font-family: var(--font-playfair, serif);
          font-style: italic;
          font-size: clamp(28px, 4.5vw, 56px);
          font-weight: 400;
          color: #5a5550;
        }
        .tpe-title-practical {
          display: block;
          font-family: var(--font-playfair, serif);
          font-size: clamp(68px, 11vw, 140px);
          font-weight: 700;
          color: #ede8df;
        }
        .tpe-title-engineer {
          display: block;
          font-family: var(--font-playfair, serif);
          font-size: clamp(68px, 11vw, 140px);
          font-weight: 700;
          background-image: linear-gradient(90deg, #f59e0b 0%, #fde68a 45%, #f59e0b 90%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: tpe-shimmer 5s linear infinite;
        }
        .tpe-title-dot {
          color: #f59e0b;
          -webkit-text-fill-color: #f59e0b;
        }

        .tpe-hero-sub {
          font-size: 19px;
          line-height: 1.75;
          color: #5a5550;
          max-width: 560px;
          margin: 0 0 44px;
        }

        .tpe-hero-actions {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
        }
        .tpe-btn-primary {
          padding: 15px 36px;
          background-color: #f59e0b;
          color: #070707;
          text-decoration: none;
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: background-color 0.2s, transform 0.15s;
        }
        .tpe-btn-primary:hover {
          background-color: #fbbf24;
          transform: translateY(-2px);
        }
        .tpe-btn-ghost {
          padding: 15px 36px;
          border: 1px solid rgba(237,232,223,0.15);
          color: #ede8df;
          text-decoration: none;
          font-weight: 500;
          font-size: 13px;
          letter-spacing: 0.06em;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: border-color 0.2s, color 0.2s;
        }
        .tpe-btn-ghost:hover {
          border-color: rgba(237,232,223,0.4);
          color: #fff;
        }

        /* Decorative oversized number */
        .tpe-deco-num {
          position: absolute;
          bottom: 40px;
          right: 48px;
          font-family: var(--font-playfair, serif);
          font-size: clamp(120px, 18vw, 260px);
          font-weight: 700;
          color: rgba(245,158,11,0.04);
          line-height: 1;
          pointer-events: none;
          user-select: none;
          letter-spacing: -0.06em;
        }

        /* ── Strip ── */
        .tpe-strip {
          position: relative;
          z-index: 2;
          border-top: 1px solid rgba(237,232,223,0.07);
          border-bottom: 1px solid rgba(237,232,223,0.07);
        }
        .tpe-strip-inner {
          max-width: 1280px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
        }
        .tpe-strip-item {
          padding: 28px 48px;
        }
        .tpe-strip-item--sep {
          border-right: 1px solid rgba(237,232,223,0.07);
        }
        .tpe-strip-value {
          font-family: var(--font-playfair, serif);
          font-size: 20px;
          font-weight: 600;
          color: #ede8df;
          margin-bottom: 6px;
          letter-spacing: -0.01em;
        }
        .tpe-strip-label {
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #3a3530;
        }

        /* ── Topics ── */
        .tpe-topics {
          position: relative;
          z-index: 2;
          max-width: 1280px;
          margin: 0 auto;
          padding: 108px 48px;
        }
        .tpe-topics-header { margin-bottom: 64px; }
        .tpe-section-eye {
          font-size: 11px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #f59e0b;
          margin-bottom: 18px;
        }
        .tpe-section-title {
          font-family: var(--font-playfair, serif);
          font-size: clamp(32px, 5vw, 56px);
          font-weight: 700;
          letter-spacing: -0.03em;
          color: #ede8df;
          margin: 0;
          line-height: 1.1;
        }

        .tpe-topics-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background-color: rgba(237,232,223,0.06);
          border: 1px solid rgba(237,232,223,0.06);
        }
        .tpe-topic-card {
          padding: 44px;
          background-color: #070707;
          transition: background-color 0.25s;
          position: relative;
        }
        .tpe-topic-card:hover { background-color: #0f0e0c; }
        .tpe-topic-num {
          display: block;
          font-family: var(--font-playfair, serif);
          font-size: 11px;
          letter-spacing: 0.14em;
          color: #f59e0b;
          margin-bottom: 20px;
        }
        .tpe-topic-title {
          font-family: var(--font-playfair, serif);
          font-size: 21px;
          font-weight: 600;
          color: #ede8df;
          margin: 0 0 14px;
          letter-spacing: -0.02em;
        }
        .tpe-topic-desc {
          font-size: 14px;
          line-height: 1.8;
          color: #3a3530;
          margin: 0;
        }

        /* ── Pull quote ── */
        .tpe-quote-section {
          position: relative;
          z-index: 2;
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 48px 100px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 32px;
          text-align: center;
        }
        .tpe-quote-rule {
          width: 60px;
          height: 1px;
          background-color: rgba(245,158,11,0.35);
        }
        .tpe-quote {
          font-family: var(--font-playfair, serif);
          font-style: italic;
          font-size: clamp(20px, 3vw, 30px);
          line-height: 1.5;
          color: #5a5550;
          margin: 0;
          max-width: 700px;
          letter-spacing: -0.01em;
        }

        /* ── CTA ── */
        .tpe-cta {
          position: relative;
          z-index: 2;
          background-color: #ede8df;
          margin: 0 48px 80px;
          overflow: hidden;
        }
        .tpe-cta-hatch {
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(
            -45deg,
            rgba(7,7,7,0.025) 0px,
            rgba(7,7,7,0.025) 1px,
            transparent 1px,
            transparent 20px
          );
          pointer-events: none;
        }
        .tpe-cta-inner {
          position: relative;
          z-index: 1;
          padding: 80px 64px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          max-width: 640px;
        }
        .tpe-eye-dark {
          color: #a09880;
        }
        .tpe-cta-title {
          font-family: var(--font-playfair, serif);
          font-size: clamp(30px, 5vw, 54px);
          font-weight: 700;
          color: #070707;
          letter-spacing: -0.03em;
          line-height: 1.1;
          margin: 0 0 22px;
        }
        .tpe-cta-body {
          font-size: 16px;
          color: #6b6560;
          line-height: 1.7;
          margin: 0 0 44px;
          max-width: 460px;
        }
        .tpe-btn-dark {
          padding: 16px 40px;
          background-color: #070707;
          color: #ede8df;
          text-decoration: none;
          font-weight: 700;
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: background-color 0.2s, transform 0.15s;
        }
        .tpe-btn-dark:hover {
          background-color: #1a1a18;
          transform: translateY(-2px);
        }

        /* ── Footer ── */
        .tpe-footer {
          position: relative;
          z-index: 2;
          border-top: 1px solid rgba(237,232,223,0.06);
        }
        .tpe-footer-inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 32px 48px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .tpe-footer-logo {
          font-family: var(--font-playfair, serif);
          font-size: 15px;
          font-weight: 600;
          color: #3a3530;
          letter-spacing: -0.01em;
        }
        .tpe-footer-copy { font-size: 12px; color: #2a2825; margin: 0; }
        .tpe-footer-links { display: flex; gap: 24px; }
        .tpe-footer-link {
          font-size: 12px;
          color: #3a3530;
          text-decoration: none;
          transition: color 0.2s;
        }
        .tpe-footer-link:hover { color: #ede8df; }

        /* ── Animations ── */
        @keyframes tpe-shimmer {
          0%   { background-position: 0% center; }
          100% { background-position: 200% center; }
        }

        /* ── Tablet ── */
        @media (max-width: 960px) {
          .tpe-nav-inner { padding: 22px 28px; }
          .tpe-logo-text { font-size: 15px; }
          .tpe-hero { padding: 60px 28px 90px; flex-direction: column; gap: 0; }
          .tpe-issue-label { display: none; }
          .tpe-deco-num { display: none; }
          .tpe-strip-inner { grid-template-columns: repeat(2, 1fr); }
          .tpe-strip-item--sep:nth-child(2) { border-right: none; }
          .tpe-strip-item:nth-child(1),
          .tpe-strip-item:nth-child(2) { border-bottom: 1px solid rgba(237,232,223,0.07); }
          .tpe-strip-item { padding: 24px 28px; }
          .tpe-topics { padding: 80px 28px; }
          .tpe-topics-grid { grid-template-columns: repeat(2, 1fr); }
          .tpe-quote-section { padding: 0 28px 80px; }
          .tpe-cta { margin: 0 28px 64px; }
          .tpe-cta-inner { padding: 60px 40px; }
          .tpe-footer-inner { flex-direction: column; text-align: center; gap: 12px; }
          .tpe-footer-inner { padding: 28px; }
          .tpe-br-md { display: none; }
        }

        /* ── Mobile ── */
        @media (max-width: 600px) {
          .tpe-nav-inner { padding: 18px 20px; }
          .tpe-nav-ghost { display: none; }
          .tpe-logo-text { font-size: 13px; }
          .tpe-hero { padding: 40px 20px 64px; }
          .tpe-hero-badge { margin-bottom: 32px; }
          .tpe-hero-sub { font-size: 16px; }
          .tpe-hero-actions { flex-direction: column; }
          .tpe-btn-primary, .tpe-btn-ghost { width: 100%; justify-content: center; }
          .tpe-topics { padding: 64px 20px; }
          .tpe-topics-grid { grid-template-columns: 1fr; }
          .tpe-topic-card { padding: 32px 28px; }
          .tpe-quote-section { padding: 0 20px 64px; }
          .tpe-cta { margin: 0 20px 56px; }
          .tpe-cta-inner { padding: 48px 28px; }
          .tpe-footer-inner { padding: 24px 20px; }
          .tpe-footer-links { gap: 16px; }
        }
      `}</style>
    </div>
  )
}
