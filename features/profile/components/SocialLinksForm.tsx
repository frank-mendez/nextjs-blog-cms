'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { updateProfile } from '@/features/profile/actions'
import type { Profile } from '@/lib/supabase/types'

const urlOrEmpty = z.string().url('Must be a valid URL').or(z.literal(''))

const schema = z.object({
  twitter_url: urlOrEmpty,
  linkedin_url: urlOrEmpty,
  github_url: urlOrEmpty,
  instagram_url: urlOrEmpty,
  facebook_url: urlOrEmpty,
  youtube_url: urlOrEmpty,
  tiktok_url: urlOrEmpty,
})

type FormValues = z.infer<typeof schema>

const SOCIALS: { key: keyof FormValues; label: string; placeholder: string }[] = [
  { key: 'twitter_url', label: 'Twitter / X', placeholder: 'https://twitter.com/yourhandle' },
  { key: 'linkedin_url', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/yourname' },
  { key: 'github_url', label: 'GitHub', placeholder: 'https://github.com/yourname' },
  { key: 'instagram_url', label: 'Instagram', placeholder: 'https://instagram.com/yourhandle' },
  { key: 'facebook_url', label: 'Facebook', placeholder: 'https://facebook.com/yourname' },
  { key: 'youtube_url', label: 'YouTube', placeholder: 'https://youtube.com/@yourchannel' },
  { key: 'tiktok_url', label: 'TikTok', placeholder: 'https://tiktok.com/@yourhandle' },
]

interface SocialLinksFormProps {
  profile: Profile
}

export function SocialLinksForm({ profile }: SocialLinksFormProps) {
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      twitter_url: profile.twitter_url ?? '',
      linkedin_url: profile.linkedin_url ?? '',
      github_url: profile.github_url ?? '',
      instagram_url: profile.instagram_url ?? '',
      facebook_url: profile.facebook_url ?? '',
      youtube_url: profile.youtube_url ?? '',
      tiktok_url: profile.tiktok_url ?? '',
    },
  })

  async function onSubmit(values: FormValues) {
    setSaving(true)
    try {
      // Convert empty strings to null for storage
      const normalized = Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, v === '' ? null : v])
      ) as FormValues
      const result = await updateProfile(normalized)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Social links updated')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Social Links</CardTitle>
        <CardDescription>Add links to your social profiles</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {SOCIALS.map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={key}>{label}</Label>
              <Input id={key} type="url" placeholder={placeholder} {...register(key)} />
              {errors[key] && <p className="text-xs text-destructive">{errors[key]?.message}</p>}
            </div>
          ))}
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
