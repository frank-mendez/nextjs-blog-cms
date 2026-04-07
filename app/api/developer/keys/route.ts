import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createApiKey, listApiKeys } from '@/features/api-keys/apiKeyService'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return null
  return user
}

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const keys = await listApiKeys(user.id)
    return NextResponse.json({ keys })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to list keys' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  try {
    const result = await createApiKey(name, user.id)
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create key' }, { status: 500 })
  }
}
