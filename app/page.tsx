import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">Blog CMS</h1>
        <p className="text-xl text-muted-foreground max-w-xl">
          A modern blog CMS built with Next.js, Supabase, and TailwindCSS.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/blog"
            className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground h-10 px-6 font-medium hover:bg-primary/90 transition-colors"
          >
            Read Blog
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background h-10 px-6 font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
