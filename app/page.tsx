import Link from 'next/link'

const pillars = [
  {
    num: '01',
    icon: '⚒️',
    title: 'System Design',
    desc: 'Architecture decisions, trade-offs, and the thinking behind systems that scale and survive production.',
    color: '#5DECF5',
  },
  {
    num: '02',
    icon: '🔧',
    title: 'Engineering Craft',
    desc: 'Clean code, testing, debugging strategies, and the fundamentals that separate good engineers from great ones.',
    color: '#5D9E1F',
  },
  {
    num: '03',
    icon: '⚡',
    title: 'Performance',
    desc: 'Making software faster. Profiling, optimization, and measuring what actually matters at scale.',
    color: '#FCBA03',
  },
  {
    num: '04',
    icon: '🛠️',
    title: 'Tooling & DX',
    desc: 'The tools, configurations, and workflows that compound over time and make engineers dramatically more productive.',
    color: '#17DD62',
  },
  {
    num: '05',
    icon: '📈',
    title: 'Career & Growth',
    desc: 'Getting better at the craft over time. Technical leadership, communication, and leveling up deliberately.',
    color: '#FF8C00',
  },
  {
    num: '06',
    icon: '🌐',
    title: 'Open Source',
    desc: 'Building, contributing, and maintaining software in the open. What it takes and why it matters.',
    color: '#C040FF',
  },
]

const stats = [
  { value: 'Deep Dives', label: 'Long-form technical' },
  { value: 'Guides', label: 'Step-by-step practical' },
  { value: 'Architecture', label: 'System design decisions' },
  { value: 'No fluff', label: 'Direct and honest' },
]

const floatingBlocks: Array<{
  color: string
  shadow: string
  size: string
  dur: string
  delay: string
  top: string
  left?: string
  right?: string
}> = [
  { color: '#5D9E1F', shadow: '#2D5A0A', top: '12%', left: '6%',  dur: '9s',  delay: '0s',   size: '32px' },
  { color: '#FCBA03', shadow: '#7A5800', top: '22%', right: '8%', dur: '11s', delay: '-3s',  size: '28px' },
  { color: '#5DECF5', shadow: '#003B42', top: '55%', left: '4%',  dur: '13s', delay: '-6s',  size: '36px' },
  { color: '#7F7F7F', shadow: '#3F3F3F', top: '68%', right: '6%', dur: '10s', delay: '-2s',  size: '24px' },
  { color: '#8B6340', shadow: '#3C2210', top: '38%', left: '10%', dur: '12s', delay: '-5s',  size: '20px' },
  { color: '#17DD62', shadow: '#0A6E30', top: '78%', right: '12%',dur: '8s',  delay: '-1s',  size: '32px' },
  { color: '#1947A3', shadow: '#0D2560', top: '88%', left: '18%', dur: '15s', delay: '-8s',  size: '28px' },
  { color: '#C01010', shadow: '#600808', top: '45%', right: '15%',dur: '10s', delay: '-4s',  size: '24px' },
]

export default function Home() {
  return (
    <>
      <style>{`
        /* ─────────────────────────────────────────────
           Pixel / Minecraft Design System
           ───────────────────────────────────────────── */

        *, *::before, *::after { box-sizing: border-box; }

        .mc-root {
          background: #0A0A0F;
          min-height: 100vh;
          color: #E8E8E8;
          overflow-x: hidden;
          position: relative;
        }

        /* 16px pixel grid overlay */
        .mc-bg-grid {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px);
          background-size: 16px 16px;
        }

        /* ── Floating blocks layer ── */
        .mc-blocks-layer {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
        }

        .mc-fblock {
          position: absolute;
          border: 2px solid rgba(0,0,0,0.55);
          animation: mc-float linear infinite;
          opacity: 0.4;
        }

        @keyframes mc-float {
          0%   { transform: translateY(0px)   rotate(0deg);  }
          25%  { transform: translateY(-22px)  rotate(6deg);  }
          60%  { transform: translateY(-6px)   rotate(-3deg); }
          80%  { transform: translateY(14px)   rotate(4deg);  }
          100% { transform: translateY(0px)   rotate(0deg);  }
        }

        /* ── NAV ── */
        .mc-nav {
          position: relative;
          z-index: 100;
          background: #161618;
          border-bottom: 4px solid #000;
          box-shadow: 0 4px 0 #2A2A2A;
        }

        .mc-nav-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 14px 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .mc-logo {
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 12px;
          font-family: var(--font-pixel, monospace);
          font-size: 10px;
          color: #FCBA03;
          text-shadow: 2px 2px 0 #7A5800;
          letter-spacing: 0.5px;
          line-height: 1;
        }

        .mc-logo-grass {
          width: 28px;
          height: 28px;
          flex-shrink: 0;
          border: 2px solid #000;
          background: #5D9E1F;
          box-shadow:
            inset -5px -5px 0 #2D5A0A,
            inset 5px 5px 0 rgba(255,255,255,0.28);
        }

        .mc-nav-links {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* ── Minecraft-style buttons ── */
        .mc-btn {
          font-family: var(--font-pixel, monospace);
          font-size: 8px;
          padding: 10px 20px;
          text-decoration: none;
          display: inline-block;
          cursor: pointer;
          background: #636363;
          color: #E0E0E0;
          border: none;
          letter-spacing: 0.5px;
          line-height: 1;
          white-space: nowrap;
          box-shadow:
            inset 3px 3px 0 #9B9B9B,
            inset -3px -3px 0 #2D2D2D,
            3px 3px 0 #000;
          transition: background 0.08s, color 0.08s, transform 0.08s, box-shadow 0.08s;
        }

        .mc-btn:hover {
          background: #7E98CF;
          color: #FFFF55;
          transform: translate(-1px, -1px);
          box-shadow:
            inset 3px 3px 0 #A4B8E0,
            inset -3px -3px 0 #3A4D6E,
            4px 4px 0 #000;
        }

        .mc-btn:active {
          transform: translate(1px, 1px);
          box-shadow:
            inset -3px -3px 0 #9B9B9B,
            inset 3px 3px 0 #2D2D2D,
            2px 2px 0 #000;
        }

        .mc-btn-primary {
          background: #2C5614;
          color: #AAFF88;
          box-shadow:
            inset 3px 3px 0 #4A8824,
            inset -3px -3px 0 #0E1E06,
            3px 3px 0 #000;
        }

        .mc-btn-primary:hover {
          background: #3A7018;
          color: #CCFFAA;
          transform: translate(-1px, -1px);
          box-shadow:
            inset 3px 3px 0 #60A030,
            inset -3px -3px 0 #162806,
            4px 4px 0 #000;
        }

        /* ── HERO ── */
        .mc-hero {
          position: relative;
          z-index: 1;
          min-height: calc(100vh - 60px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 32px 100px;
          text-align: center;
        }

        .mc-hero-badge {
          font-family: var(--font-pixel, monospace);
          font-size: 8px;
          color: #17DD62;
          background: rgba(23,221,98,0.07);
          border: 2px solid #17DD62;
          padding: 8px 20px;
          display: inline-block;
          margin-bottom: 44px;
          letter-spacing: 2px;
          text-shadow: 1px 1px 0 #064020;
          animation: mc-badge-pulse 3s ease-in-out infinite;
        }

        @keyframes mc-badge-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(23,221,98,0); }
          50%       { box-shadow: 0 0 12px 4px rgba(23,221,98,0.12); }
        }

        .mc-hero-title {
          margin: 0 0 36px;
          line-height: 1;
          font-style: normal;
        }

        .mc-title-the {
          display: block;
          font-family: var(--font-pixel, monospace);
          font-size: clamp(11px, 1.5vw, 16px);
          color: #444;
          text-shadow: 1px 1px 0 #000;
          margin-bottom: 14px;
          letter-spacing: 10px;
        }

        .mc-title-practical {
          display: block;
          font-family: var(--font-pixel, monospace);
          font-size: clamp(22px, 4vw, 44px);
          color: #FCBA03;
          text-shadow:
            3px 3px 0 #7A5800,
            6px 6px 0 #000;
          margin-bottom: 18px;
          letter-spacing: 2px;
        }

        .mc-title-engineer {
          display: block;
          font-family: var(--font-pixel, monospace);
          font-size: clamp(16px, 3vw, 30px);
          color: #5DECF5;
          text-shadow:
            2px 2px 0 #003B42,
            5px 5px 0 #000;
          letter-spacing: 2px;
        }

        .mc-cursor {
          display: inline-block;
          width: 3px;
          height: 1em;
          background: #5DECF5;
          margin-left: 8px;
          vertical-align: middle;
          animation: mc-blink 1s step-end infinite;
        }

        @keyframes mc-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }

        .mc-hero-sub {
          font-family: var(--font-vt323, monospace);
          font-size: clamp(18px, 2.2vw, 23px);
          color: #777;
          max-width: 580px;
          line-height: 1.65;
          margin: 0 auto 56px;
          letter-spacing: 0.5px;
        }

        .mc-hero-actions {
          display: flex;
          gap: 16px;
          justify-content: center;
          flex-wrap: wrap;
        }

        /* ── GRASS DIVIDER ── */
        .mc-grass-divider {
          position: relative;
          z-index: 1;
          height: 24px;
          background: linear-gradient(
            to bottom,
            #5D9E1F 0%,
            #5D9E1F 40%,
            #7B4F2E 40%
          );
          border-top: 3px solid #2D5A0A;
          border-bottom: 3px solid #3C2210;
        }

        /* ── STATS STRIP ── */
        .mc-stats {
          position: relative;
          z-index: 1;
          background: #0E0E13;
          border-bottom: 4px solid #1A1A1A;
          padding: 32px;
        }

        .mc-stats-inner {
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 2px;
        }

        .mc-stat {
          text-align: center;
          padding: 22px 16px;
          border: 2px solid #1C1C1C;
          background: #111116;
          box-shadow: inset 1px 1px 0 rgba(255,255,255,0.03);
        }

        .mc-stat-value {
          font-family: var(--font-pixel, monospace);
          font-size: 9px;
          color: #FCBA03;
          text-shadow: 1px 1px 0 #7A5800;
          display: block;
          margin-bottom: 10px;
          letter-spacing: 0.5px;
        }

        .mc-stat-label {
          font-family: var(--font-vt323, monospace);
          font-size: 18px;
          color: #444;
          letter-spacing: 1px;
        }

        /* ── TOPICS / BIOMES ── */
        .mc-topics-section {
          position: relative;
          z-index: 1;
          padding: 80px 32px;
          background: #0D0D12;
        }

        .mc-topics-inner {
          max-width: 1100px;
          margin: 0 auto;
        }

        .mc-section-header {
          text-align: center;
          margin-bottom: 56px;
        }

        .mc-section-eyebrow {
          font-family: var(--font-pixel, monospace);
          font-size: 7px;
          color: #3A3A3A;
          letter-spacing: 5px;
          margin-bottom: 20px;
          display: block;
        }

        .mc-section-title {
          font-family: var(--font-pixel, monospace);
          font-size: clamp(12px, 2vw, 18px);
          color: #FCBA03;
          text-shadow: 2px 2px 0 #7A5800, 4px 4px 0 #000;
          margin: 0 0 14px;
          letter-spacing: 1px;
        }

        .mc-section-sub {
          font-family: var(--font-vt323, monospace);
          font-size: 20px;
          color: #444;
          letter-spacing: 1px;
        }

        .mc-topics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
          gap: 3px;
        }

        /* Inventory slot / item frame */
        .mc-card {
          background: #111116;
          border: 3px solid #2A2A2A;
          box-shadow:
            inset 2px 2px 0 rgba(255,255,255,0.05),
            inset -2px -2px 0 rgba(0,0,0,0.5);
          padding: 28px 24px;
          transition: border-color 0.12s, background 0.12s;
          position: relative;
          overflow: hidden;
        }

        .mc-card::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: var(--card-accent, #555);
          opacity: 0;
          transition: opacity 0.12s;
        }

        .mc-card:hover {
          background: #18181F;
          border-color: var(--card-accent, #FCBA03);
        }

        .mc-card:hover::after { opacity: 1; }

        .mc-card-num {
          font-family: var(--font-pixel, monospace);
          font-size: 7px;
          color: #2A2A2A;
          display: block;
          margin-bottom: 16px;
          letter-spacing: 1px;
          transition: color 0.12s;
        }

        .mc-card:hover .mc-card-num { color: var(--card-accent, #555); }

        .mc-card-icon {
          font-size: 34px;
          display: block;
          margin-bottom: 14px;
          line-height: 1;
        }

        .mc-card-title {
          font-family: var(--font-pixel, monospace);
          font-size: 9px;
          color: #E8E8E8;
          display: block;
          margin-bottom: 14px;
          text-shadow: 1px 1px 0 #000;
          letter-spacing: 0.5px;
        }

        .mc-card-desc {
          font-family: var(--font-vt323, monospace);
          font-size: 18px;
          color: #555;
          line-height: 1.55;
        }

        /* ── BOOK QUOTE ── */
        .mc-quote-section {
          position: relative;
          z-index: 1;
          padding: 80px 32px;
          background: #0A0A0F;
          border-top: 4px solid #111;
          border-bottom: 4px solid #111;
        }

        .mc-book {
          max-width: 620px;
          margin: 0 auto;
          background: #EDD9A3;
          border: 6px solid #5C3D11;
          box-shadow: 8px 8px 0 #000, inset 0 0 0 3px rgba(92,61,17,0.18);
          padding: 48px 52px 48px 72px;
          position: relative;
        }

        /* Spine */
        .mc-book::before {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          width: 22px;
          background: #5C3D11;
          border-right: 4px solid #7A5018;
        }

        .mc-book-header {
          font-family: var(--font-pixel, monospace);
          font-size: 7px;
          color: #7A5018;
          letter-spacing: 4px;
          text-align: center;
          margin-bottom: 20px;
        }

        .mc-book-rule {
          border: none;
          border-top: 2px solid #C4AA7A;
          margin: 20px 0;
        }

        .mc-book-quote {
          font-family: var(--font-pixel, monospace);
          font-size: 9px;
          color: #1A0E00;
          line-height: 2.4;
          text-align: center;
          margin: 0;
          letter-spacing: 0.5px;
        }

        .mc-book-sig {
          font-family: var(--font-vt323, monospace);
          font-size: 20px;
          color: #7A5018;
          text-align: center;
          letter-spacing: 3px;
          font-style: italic;
          margin-top: 6px;
        }

        /* ── CTA ── */
        .mc-cta {
          position: relative;
          z-index: 1;
          padding: 96px 32px;
          text-align: center;
          background: #0D0D12;
          border-top: 4px solid #1A1A1A;
        }

        .mc-cta-inner { max-width: 640px; margin: 0 auto; }

        .mc-cta-title {
          font-family: var(--font-pixel, monospace);
          font-size: clamp(13px, 2.5vw, 20px);
          color: #E8E8E8;
          text-shadow: 3px 3px 0 #000;
          margin: 0 0 18px;
          letter-spacing: 1px;
          line-height: 1.7;
        }

        .mc-cta-sub {
          font-family: var(--font-vt323, monospace);
          font-size: 21px;
          color: #555;
          margin: 0 0 52px;
          line-height: 1.65;
        }

        .mc-cta-actions {
          display: flex;
          gap: 16px;
          justify-content: center;
          flex-wrap: wrap;
        }

        /* ── FOOTER ── */
        .mc-footer {
          position: relative;
          z-index: 1;
          background: #080808;
          border-top: 4px solid #000;
          padding: 28px 32px;
          text-align: center;
        }

        .mc-footer-links {
          display: flex;
          gap: 28px;
          justify-content: center;
          margin-bottom: 16px;
        }

        .mc-footer-link {
          font-family: var(--font-pixel, monospace);
          font-size: 7px;
          color: #333;
          text-decoration: none;
          letter-spacing: 1px;
          transition: color 0.1s;
        }

        .mc-footer-link:hover { color: #FCBA03; }

        .mc-footer-copy {
          font-family: var(--font-pixel, monospace);
          font-size: 6px;
          color: #272727;
          letter-spacing: 1px;
          line-height: 2.5;
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 640px) {
          .mc-stats-inner {
            grid-template-columns: repeat(2, 1fr);
          }
          .mc-nav-inner { padding: 12px 16px; }
          .mc-hero { padding: 48px 16px 64px; }
          .mc-topics-section { padding: 48px 16px; }
          .mc-book { padding: 40px 32px 40px 56px; }
          .mc-cta { padding: 64px 16px; }
        }
      `}</style>

      <div className="mc-root">
        {/* Pixel grid */}
        <div className="mc-bg-grid" aria-hidden />

        {/* Floating Minecraft blocks */}
        <div className="mc-blocks-layer" aria-hidden>
          {floatingBlocks.map((b, i) => (
            <div
              key={i}
              className="mc-fblock"
              style={{
                width: b.size,
                height: b.size,
                background: b.color,
                boxShadow: `inset -5px -5px 0 ${b.shadow}, inset 5px 5px 0 rgba(255,255,255,0.22)`,
                top: b.top,
                left: b.left,
                right: b.right,
                animationDuration: b.dur,
                animationDelay: b.delay,
              } as React.CSSProperties}
            />
          ))}
        </div>

        {/* ── Nav ── */}
        <nav className="mc-nav">
          <div className="mc-nav-inner">
            <Link href="/" className="mc-logo">
              <div className="mc-logo-grass" aria-hidden />
              THE PRACTICAL ENGINEER
            </Link>
            <div className="mc-nav-links">
              <Link href="/blog" className="mc-btn">Articles</Link>
              <Link href="/dashboard" className="mc-btn mc-btn-primary">Dashboard</Link>
            </div>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="mc-hero">
          <div className="mc-hero-badge">
            ▶&nbsp; Practical · Honest · Opinionated &nbsp;◀
          </div>

          <h1 className="mc-hero-title">
            <span className="mc-title-the">THE</span>
            <span className="mc-title-practical">PRACTICAL</span>
            <span className="mc-title-engineer">
              ENGINEER<span className="mc-cursor" aria-hidden />
            </span>
          </h1>

          <p className="mc-hero-sub">
            In-depth technical writing for engineers who care about craft.
            No padding, no filler — just hard-won knowledge from real engineering work.
          </p>

          <div className="mc-hero-actions">
            <Link href="/blog" className="mc-btn mc-btn-primary">▶ Read Articles</Link>
            <Link href="/dashboard" className="mc-btn">Open Dashboard</Link>
          </div>
        </section>

        {/* Grass/dirt block divider */}
        <div className="mc-grass-divider" aria-hidden />

        {/* ── Stats ── */}
        <div className="mc-stats">
          <div className="mc-stats-inner">
            {stats.map((s) => (
              <div key={s.value} className="mc-stat">
                <span className="mc-stat-value">{s.value}</span>
                <span className="mc-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Topics / Biomes ── */}
        <section className="mc-topics-section">
          <div className="mc-topics-inner">
            <div className="mc-section-header">
              <span className="mc-section-eyebrow">▪ SELECT YOUR PATH ▪</span>
              <h2 className="mc-section-title">CHOOSE A BIOME</h2>
              <p className="mc-section-sub">Six areas of engineering knowledge. Zero fluff.</p>
            </div>

            <div className="mc-topics-grid">
              {pillars.map((p) => (
                <div
                  key={p.num}
                  className="mc-card"
                  style={{ '--card-accent': p.color } as React.CSSProperties}
                >
                  <span className="mc-card-num"># {p.num}</span>
                  <span className="mc-card-icon">{p.icon}</span>
                  <span className="mc-card-title">{p.title.toUpperCase()}</span>
                  <p className="mc-card-desc">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Written Book Quote ── */}
        <section className="mc-quote-section">
          <div className="mc-book">
            <p className="mc-book-header">📖 &nbsp; WRITTEN IN STONE &nbsp; 📖</p>
            <hr className="mc-book-rule" />
            <p className="mc-book-quote">
              &ldquo;The goal is not to write about engineering.<br />
              The goal is to make you a better engineer.&rdquo;
            </p>
            <hr className="mc-book-rule" />
            <p className="mc-book-sig">— The Practical Engineer</p>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="mc-cta">
          <div className="mc-cta-inner">
            <h2 className="mc-cta-title">READY TO LEVEL UP?</h2>
            <p className="mc-cta-sub">
              Start with any article. Each one is designed to make you a sharper,
              more intentional engineer.
            </p>
            <div className="mc-cta-actions">
              <Link href="/blog" className="mc-btn mc-btn-primary">▶ Browse Articles</Link>
              <Link href="/dashboard" className="mc-btn">Open Dashboard</Link>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="mc-footer">
          <div className="mc-footer-links">
            <Link href="/blog" className="mc-footer-link">Articles</Link>
            <Link href="/dashboard" className="mc-footer-link">Dashboard</Link>
          </div>
          <p className="mc-footer-copy">
            © {new Date().getFullYear()} THE PRACTICAL ENGINEER. ALL RIGHTS RESERVED.
          </p>
        </footer>
      </div>
    </>
  )
}
