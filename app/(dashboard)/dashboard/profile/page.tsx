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
    <div className="p-8 animate-page">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your personal information and account settings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Main column */}
        <div className="space-y-6">
          <GeneralInfoForm profile={profile} />
          <SocialLinksForm profile={profile} />
        </div>

        {/* Side column */}
        <div className="space-y-6">
          <AvatarUpload profile={profile} />
          <ChangePasswordForm />
          <TwoFactorSetup />
        </div>
      </div>
    </div>
  )
}
