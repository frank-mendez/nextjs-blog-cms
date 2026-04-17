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
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { updateProfile } from '@/features/profile/actions'
import type { Profile } from '@/lib/supabase/types'

const schema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  pronouns: z.string(),
  bio: z.string(),
  company: z.string(),
  location: z.string(),
  website: z.string().url('Must be a valid URL').or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

interface GeneralInfoFormProps {
  profile: Profile
}

export function GeneralInfoForm({ profile }: GeneralInfoFormProps) {
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: profile.full_name ?? '',
      pronouns: profile.pronouns ?? '',
      bio: profile.bio ?? '',
      company: profile.company ?? '',
      location: profile.location ?? '',
      website: profile.website ?? '',
    },
  })

  function normalizeOptional(v: string): string | null {
    return v.trim() === '' ? null : v
  }

  async function onSubmit(values: FormValues) {
    setSaving(true)
    try {
      const result = await updateProfile({
        full_name: values.full_name,
        pronouns: normalizeOptional(values.pronouns),
        bio: normalizeOptional(values.bio),
        company: normalizeOptional(values.company),
        location: normalizeOptional(values.location),
        website: normalizeOptional(values.website),
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Profile updated')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>General Information</CardTitle>
        <CardDescription>Your name and public profile details</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full Name</Label>
              <Input id="full_name" {...register('full_name')} />
              {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pronouns">Pronouns</Label>
              <Input id="pronouns" placeholder="e.g. he/him, she/her, they/them" {...register('pronouns')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" rows={3} placeholder="Tell us a little about yourself" {...register('bio')} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="company">Company</Label>
              <Input id="company" {...register('company')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input id="location" placeholder="City, Country" {...register('location')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="website">Website</Label>
            <Input id="website" type="url" placeholder="https://yoursite.com" {...register('website')} />
            {errors.website && <p className="text-xs text-destructive">{errors.website.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={profile.email} disabled className="opacity-60 cursor-not-allowed" />
            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
          </div>

          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
