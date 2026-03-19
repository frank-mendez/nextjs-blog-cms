import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { format } from 'date-fns'
import type { Metadata } from 'next'
import { getPostBySlug, getAllPublishedSlugs } from '@/features/posts/queries'
import { EditorContent } from '@/components/editor/EditorContent'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { BackToTopButton } from '@/components/BackToTopButton'

export const revalidate = 3600

interface PostPageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const slugs = await getAllPublishedSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post) return {}

  return {
    title: post.seo_title || post.title,
    description: post.seo_description || post.excerpt || '',
    openGraph: {
      title: post.seo_title || post.title,
      description: post.seo_description || post.excerpt || '',
      images: post.cover_image ? [post.cover_image] : [],
      type: 'article',
      publishedTime: post.published_at ?? undefined,
      authors: post.author?.full_name ? [post.author.full_name] : undefined,
    },
  }
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post) notFound()

  const initials = post.author?.full_name
    ? post.author.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : post.author?.email?.[0]?.toUpperCase() ?? '?'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt ?? post.seo_description ?? '',
    image: post.cover_image ? [post.cover_image] : [],
    datePublished: post.published_at,
    dateModified: post.updated_at,
    author: post.author?.full_name
      ? [{ '@type': 'Person', name: post.author.full_name }]
      : [],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="container max-w-3xl mx-auto py-12 px-4">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
            Back to Blog
          </Link>
          {post.category && (
            <Link href={`/blog/category/${post.category.slug}`}>
              <Badge className="rounded-full px-3 text-xs">{post.category.name}</Badge>
            </Link>
          )}
        </div>

        <h1 className="text-4xl font-bold mb-4">{post.title}</h1>

        <div className="flex items-center gap-3 mb-8 text-sm text-muted-foreground">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span>{post.author?.full_name ?? post.author?.email}</span>
          {post.published_at && (
            <>
              <span>·</span>
              <time dateTime={post.published_at}>
                {format(new Date(post.published_at), 'MMMM d, yyyy')}
              </time>
            </>
          )}
        </div>

        {post.cover_image && (
          <div className="relative h-64 sm:h-80 lg:h-96 rounded-xl overflow-hidden mb-8">
            <Image
              src={post.cover_image}
              alt={post.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}

        {post.excerpt && (
          <p className="text-lg text-muted-foreground mb-8 border-l-4 border-primary pl-4 italic">
            {post.excerpt}
          </p>
        )}

        <EditorContent content={post.content ?? ''} />

        {post.tags && post.tags.length > 0 && (
          <div className="mt-12 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Link key={tag.id} href={`/blog/tag/${tag.slug}`}>
                <Badge variant="secondary" className="rounded-full px-3 text-xs">#{tag.name}</Badge>
              </Link>
            ))}
          </div>
        )}
      </article>
      <BackToTopButton />
    </>
  )
}
