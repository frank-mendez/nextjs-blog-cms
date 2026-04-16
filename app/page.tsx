import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Press_Start_2P, VT323 } from 'next/font/google'
import styles from './page.module.css'

// Scoped only to this route — not loaded globally
const pressStart2P = Press_Start_2P({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-pixel',
  display: 'swap',
})

const vt323 = VT323({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-vt323',
  display: 'swap',
})

// Shorthand helper for CSS module class names
const s = (name: string) => styles[name as keyof typeof styles] ?? ''

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
  { color: '#5D9E1F', shadow: '#2D5A0A', top: '12%', left: '6%',   dur: '9s',  delay: '0s',  size: '32px' },
  { color: '#FCBA03', shadow: '#7A5800', top: '22%', right: '8%',  dur: '11s', delay: '-3s', size: '28px' },
  { color: '#5DECF5', shadow: '#003B42', top: '55%', left: '4%',   dur: '13s', delay: '-6s', size: '36px' },
  { color: '#7F7F7F', shadow: '#3F3F3F', top: '68%', right: '6%',  dur: '10s', delay: '-2s', size: '24px' },
  { color: '#8B6340', shadow: '#3C2210', top: '38%', left: '10%',  dur: '12s', delay: '-5s', size: '20px' },
  { color: '#17DD62', shadow: '#0A6E30', top: '78%', right: '12%', dur: '8s',  delay: '-1s', size: '32px' },
  { color: '#1947A3', shadow: '#0D2560', top: '88%', left: '18%',  dur: '15s', delay: '-8s', size: '28px' },
  { color: '#C01010', shadow: '#600808', top: '45%', right: '15%', dur: '10s', delay: '-4s', size: '24px' },
]

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const params = await searchParams
  if (params.code) {
    redirect(`/auth/callback?code=${params.code}`)
  }
  return <HomeContent />
}

function HomeContent() {
  return (
    <div
      className={`${s('root')} ${pressStart2P.variable} ${vt323.variable}`}
    >
      {/* Pixel grid */}
      <div className={s('bgGrid')} aria-hidden />

      {/* Floating Minecraft blocks */}
      <div className={s('blocksLayer')} aria-hidden>
        {floatingBlocks.map((b, i) => (
          <div
            key={i}
            className={s('fblock')}
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
      <nav className={s('nav')}>
        <div className={s('navInner')}>
          <Link href="/" className={s('logo')}>
            <div className={s('logoGrass')} aria-hidden />
            THE PRACTICAL ENGINEER
          </Link>
          <div className={s('navLinks')}>
            <Link href="/blog" className={s('btn')}>Articles</Link>
            <Link href="/dashboard" className={`${s('btn')} ${s('btnPrimary')}`}>Dashboard</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className={s('hero')}>
        <div className={s('heroBadge')}>
          ▶&nbsp; Practical · Honest · Opinionated &nbsp;◀
        </div>

        <h1 className={s('heroTitle')}>
          <span className={s('titleThe')}>THE</span>
          <span className={s('titlePractical')}>PRACTICAL</span>
          <span className={s('titleEngineer')}>
            ENGINEER<span className={s('cursor')} aria-hidden />
          </span>
        </h1>

        <p className={s('heroSub')}>
          In-depth technical writing for engineers who care about craft.
          No padding, no filler — just hard-won knowledge from real engineering work.
        </p>

        <div className={s('heroActions')}>
          <Link href="/blog" className={`${s('btn')} ${s('btnPrimary')}`}>▶ Read Articles</Link>
          <Link href="/dashboard" className={s('btn')}>Open Dashboard</Link>
        </div>
      </section>

      {/* Grass/dirt block divider */}
      <div className={s('grassDivider')} aria-hidden />

      {/* ── Stats ── */}
      <div className={s('stats')}>
        <div className={s('statsInner')}>
          {stats.map((stat) => (
            <div key={stat.value} className={s('stat')}>
              <span className={s('statValue')}>{stat.value}</span>
              <span className={s('statLabel')}>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Topics / Biomes ── */}
      <section className={s('topicsSection')}>
        <div className={s('topicsInner')}>
          <div className={s('sectionHeader')}>
            <span className={s('sectionEyebrow')}>▪ SELECT YOUR PATH ▪</span>
            <h2 className={s('sectionTitle')}>CHOOSE A BIOME</h2>
            <p className={s('sectionSub')}>Six areas of engineering knowledge. Zero fluff.</p>
          </div>

          <div className={s('topicsGrid')}>
            {pillars.map((p) => (
              <div
                key={p.num}
                className={s('card')}
                style={{ '--card-accent': p.color } as React.CSSProperties}
              >
                <span className={s('cardNum')}># {p.num}</span>
                <span className={s('cardIcon')}>{p.icon}</span>
                <span className={s('cardTitle')}>{p.title.toUpperCase()}</span>
                <p className={s('cardDesc')}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Written Book Quote ── */}
      <section className={s('quoteSection')}>
        <div className={s('book')}>
          <p className={s('bookHeader')}>📖 &nbsp; WRITTEN IN STONE &nbsp; 📖</p>
          <hr className={s('bookRule')} />
          <p className={s('bookQuote')}>
            &ldquo;The goal is not to write about engineering.<br />
            The goal is to make you a better engineer.&rdquo;
          </p>
          <hr className={s('bookRule')} />
          <p className={s('bookSig')}>— The Practical Engineer</p>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className={s('cta')}>
        <div className={s('ctaInner')}>
          <h2 className={s('ctaTitle')}>READY TO LEVEL UP?</h2>
          <p className={s('ctaSub')}>
            Start with any article. Each one is designed to make you a sharper,
            more intentional engineer.
          </p>
          <div className={s('ctaActions')}>
            <Link href="/blog" className={`${s('btn')} ${s('btnPrimary')}`}>▶ Browse Articles</Link>
            <Link href="/dashboard" className={s('btn')}>Open Dashboard</Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={s('footer')}>
        <div className={s('footerLinks')}>
          <Link href="/blog" className={s('footerLink')}>Articles</Link>
          <Link href="/dashboard" className={s('footerLink')}>Dashboard</Link>
        </div>
        <p className={s('footerCopy')}>
          © {new Date().getFullYear()} THE PRACTICAL ENGINEER. ALL RIGHTS RESERVED.
        </p>
      </footer>
    </div>
  )
}
