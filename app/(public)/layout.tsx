import Link from 'next/link'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container max-w-5xl mx-auto py-4 flex items-center justify-between">
          <Link href="/" className="font-bold text-xl">Blog CMS</Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/blog" className="text-muted-foreground hover:text-foreground transition-colors">
              Blog
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground h-8 px-4 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Blog CMS. All rights reserved.</p>
      </footer>
    </div>
  )
}
