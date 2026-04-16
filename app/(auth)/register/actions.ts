'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function register(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      data: {
        full_name: formData.get('full_name') as string,
      },
    },
  }

  const { data: authData, error } = await supabase.auth.signUp({
    ...data,
    options: {
      ...data.options,
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://blog.frankmendez.site'}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  // If no session, email confirmation is required
  if (!authData.session) {
    return { needsConfirmation: true }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}
