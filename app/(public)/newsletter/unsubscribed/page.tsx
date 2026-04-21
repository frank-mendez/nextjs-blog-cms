import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Unsubscribed' }

export default function UnsubscribedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold">You&apos;ve been unsubscribed</h1>
        <p className="text-muted-foreground">
          You won&apos;t receive any more newsletter emails. If you change your mind, you can
          subscribe again from any blog post.
        </p>
        <Link
          href="/blog"
          className="inline-block text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          Back to Blog
        </Link>
      </div>
    </div>
  )
}
