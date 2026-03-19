import Link from 'next/link'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60 sticky top-0 z-50 bg-background/95 backdrop-blur-sm">
        <div className="container max-w-5xl mx-auto py-4 px-4 flex items-center justify-between">
          <Link
            href="/"
            className="font-bold text-lg tracking-tight"
            style={{ fontFamily: 'var(--font-playfair, serif)' }}
          >
            <span style={{ color: '#f59e0b' }}>✦</span> The Practical Engineer
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/blog" className="text-muted-foreground hover:text-foreground transition-colors text-xs uppercase tracking-widest">
              Articles
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center bg-foreground text-background h-8 px-4 text-xs font-semibold uppercase tracking-wider hover:opacity-80 transition-opacity"
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t py-8 text-center text-xs text-muted-foreground/60 tracking-wide">
        <p>&copy; {new Date().getFullYear()} The Practical Engineer. All rights reserved.</p>
      </footer>
    </div>
  )
}
