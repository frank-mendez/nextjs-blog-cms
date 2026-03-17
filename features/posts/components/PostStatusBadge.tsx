import { Badge } from '@/components/ui/badge'

interface PostStatusBadgeProps {
  status: string
}

export function PostStatusBadge({ status }: PostStatusBadgeProps) {
  if (status === 'published') {
    return <Badge variant="default">Published</Badge>
  }
  return <Badge variant="secondary">Draft</Badge>
}
