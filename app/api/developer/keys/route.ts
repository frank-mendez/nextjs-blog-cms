import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/api/auth'
import { createApiKey, listApiKeys } from '@/features/api-keys/apiKeyService'

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const keys = await listApiKeys(user.id)
    return NextResponse.json({ keys })
  } catch (err) {
    console.error('[API] Failed to list keys:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Failed to list keys' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
  }

  const name = typeof (body as Record<string, unknown>)?.name === 'string'
    ? ((body as Record<string, unknown>).name as string).trim()
    : ''
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  try {
    const result = await createApiKey(name, user.id)
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error('[API] Failed to create key:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Failed to create key' }, { status: 500 })
  }
}
