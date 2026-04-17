import type { Metadata } from 'next'
import { requireAuth } from '@/lib/auth/session'
import { GeneralInfoForm } from '@/features/profile/components/GeneralInfoForm'
import { AvatarUpload } from '@/features/profile/components/AvatarUpload'
import { SocialLinksForm } from '@/features/profile/components/SocialLinksForm'
import { ChangePasswordForm } from '@/features/profile/components/ChangePasswordForm'
import { TwoFactorSetup } from '@/features/profile/components/TwoFactorSetup'

export const metadata: Metadata = { title: 'My Profile' }

export default async function ProfilePage() {
  const profile = await requireAuth()

  return (
    <div className="p-8 max-w-2xl space-y-6 animate-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your personal information and account settings
        </p>
      </div>

      <GeneralInfoForm profile={profile} />
      <AvatarUpload profile={profile} />
      <SocialLinksForm profile={profile} />
      <ChangePasswordForm />
      <TwoFactorSetup />
    </div>
  )
}
