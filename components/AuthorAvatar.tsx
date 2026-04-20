const COLORS = [
  '#f59e0b', '#10b981', '#6366f1', '#ec4899',
  '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4',
]

function nameToColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash + name.charCodeAt(i)) % COLORS.length
  }
  return COLORS[hash]
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface AuthorAvatarProps {
  name: string
  size?: number
}

export function AuthorAvatar({ name, size = 32 }: AuthorAvatarProps) {
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background: nameToColor(name),
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: `${Math.round(size * 0.34)}px`,
        fontWeight: 700,
        color: '#fff',
        userSelect: 'none',
      }}
      role="img"
      aria-label={name.trim() || 'Unknown author'}
    >
      <span aria-hidden="true">{getInitials(name)}</span>
    </div>
  )
}
