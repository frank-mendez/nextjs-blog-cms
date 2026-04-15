import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, unlinkSync, existsSync } from 'fs'

config({ path: '.env.local' })

export default async function globalTeardown() {
  if (!existsSync('.e2e-state.json')) {
    console.log('No .e2e-state.json found — skipping teardown')
    return
  }

  const { userId } = JSON.parse(readFileSync('.e2e-state.json', 'utf8')) as {
    userId: string
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Fetch all post IDs for this user (seed posts + any created by tests)
  const { data: posts } = await supabase
    .from('posts')
    .select('id')
    .eq('author_id', userId)

  const postIds = (posts ?? []).map((p) => p.id)

  if (postIds.length > 0) {
    await supabase.from('post_tags').delete().in('post_id', postIds)
    await supabase.from('posts').delete().eq('author_id', userId)
  }

  await supabase.from('api_keys').delete().eq('user_id', userId)
  await supabase.from('profiles').delete().eq('id', userId)
  await supabase.auth.admin.deleteUser(userId)

  unlinkSync('.e2e-state.json')

  console.log(`✓ E2E teardown complete — all rows for user ${userId} removed`)
}
