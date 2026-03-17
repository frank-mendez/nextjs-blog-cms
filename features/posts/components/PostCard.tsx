import Link from 'next/link'
import Image from 'next/image'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { PostWithRelations } from '../types'

interface PostCardProps {
  post: PostWithRelations
}

export function PostCard({ post }: PostCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      {post.cover_image && (
        <div className="relative h-48 w-full">
          <Image
            src={post.cover_image}
            alt={post.title}
            fill
            className="object-cover"
          />
        </div>
      )}
      <CardHeader className="pb-2">
        {post.category && (
          <Link href={`/blog/category/${post.category.slug}`}>
            <Badge variant="outline" className="mb-2 text-xs">{post.category.name}</Badge>
          </Link>
        )}
        <Link href={`/blog/${post.slug}`}>
          <h2 className="text-xl font-semibold hover:text-primary transition-colors line-clamp-2">
            {post.title}
          </h2>
        </Link>
      </CardHeader>
      <CardContent>
        {post.excerpt && (
          <p className="text-muted-foreground text-sm line-clamp-3 mb-4">{post.excerpt}</p>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{post.author?.full_name ?? post.author?.email ?? 'Unknown'}</span>
          {post.published_at && (
            <time dateTime={post.published_at}>
              {format(new Date(post.published_at), 'MMM d, yyyy')}
            </time>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
