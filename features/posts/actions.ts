'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import slugify from 'slugify'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { can } from '@/lib/permissions'
import type { Role } from '@/lib/permissions'
import type { PostFormValues } from './types'

async function getCurrentProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
}

async function generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
  const supabase = await createClient()
  const base = slugify(title, { lower: true, strict: true })
  let slug = base
  let counter = 2

  while (true) {
    let query = supabase.from('posts').select('id').eq('slug', slug)
    if (excludeId) query = query.neq('id', excludeId)
    const { data } = await query
    if (!data || data.length === 0) break
    slug = `${base}-${counter}`
    counter++
  }

  return slug
}

export async function createPost(values: PostFormValues) {
  const profile = await getCurrentProfile()
  if (!profile || !can(profile.role as Role, 'posts:create')) {
    return { error: 'Unauthorized' }
  }

  const supabase = await createClient()
  const slug = values.slug || await generateUniqueSlug(values.title)

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      title: values.title,
      slug,
      excerpt: values.excerpt || null,
      content: values.content || null,
      cover_image: values.cover_image || null,
      category_id: values.category_id || null,
      seo_title: values.seo_title || null,
      seo_description: values.seo_description || null,
      author_id: profile.id,
      status: 'draft',
    })
    .select()
    .single()

  if (error) return { error: error.message }

  // Handle tags
  if (values.tag_ids?.length > 0) {
    await supabase.from('post_tags').insert(
      values.tag_ids.map((tag_id) => ({ post_id: post.id, tag_id }))
    )
  }

  revalidatePath('/dashboard/posts')
  return { data: post }
}

export async function updatePost(id: string, values: PostFormValues) {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Unauthorized' }

  const supabase = await createClient()

  // Check ownership for non-admins
  if (profile.role !== 'admin') {
    const { data: existing } = await supabase
      .from('posts')
      .select('author_id')
      .eq('id', id)
      .single()

    if (existing?.author_id !== profile.id) {
      return { error: 'Unauthorized' }
    }
  }

  const slug = values.slug || await generateUniqueSlug(values.title, id)

  const { data: post, error } = await supabase
    .from('posts')
    .update({
      title: values.title,
      slug,
      excerpt: values.excerpt || null,
      content: values.content || null,
      cover_image: values.cover_image || null,
      category_id: values.category_id || null,
      seo_title: values.seo_title || null,
      seo_description: values.seo_description || null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }

  // Replace tags
  await supabase.from('post_tags').delete().eq('post_id', id)
  if (values.tag_ids?.length > 0) {
    await supabase.from('post_tags').insert(
      values.tag_ids.map((tag_id) => ({ post_id: id, tag_id }))
    )
  }

  revalidatePath('/dashboard/posts')
  revalidatePath(`/blog/${slug}`)
  return { data: post }
}

export async function publishPost(id: string) {
  const profile = await getCurrentProfile()
  if (!profile || !can(profile.role as Role, 'posts:publish')) {
    return { error: 'Unauthorized' }
  }

  const supabase = await createClient()
  const { data: post, error } = await supabase
    .from('posts')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/dashboard/posts')
  revalidatePath('/blog')
  revalidatePath(`/blog/${post.slug}`)
  return { data: post }
}

export async function unpublishPost(id: string) {
  const profile = await getCurrentProfile()
  if (!profile || !can(profile.role as Role, 'posts:publish')) {
    return { error: 'Unauthorized' }
  }

  const supabase = await createClient()
  const { data: post, error } = await supabase
    .from('posts')
    .update({ status: 'draft', published_at: null })
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/dashboard/posts')
  revalidatePath('/blog')
  revalidatePath(`/blog/${post.slug}`)
  return { data: post }
}

export async function deletePost(id: string) {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Unauthorized' }

  const supabase = await createClient()

  if (profile.role !== 'admin') {
    const { data: existing } = await supabase
      .from('posts')
      .select('author_id')
      .eq('id', id)
      .single()

    if (existing?.author_id !== profile.id) {
      return { error: 'Unauthorized' }
    }
  }

  const { error } = await supabase.from('posts').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/posts')
  revalidatePath('/blog')
  redirect('/dashboard/posts')
}
