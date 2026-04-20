# Profile Feature Design

**Date:** 2026-04-17  
**Branch:** feature/profile  
**Status:** Approved

---

## Overview

A profile settings page at `/dashboard/profile` where authenticated users can update their personal information, upload a photo, manage social links, change their password, and enable/disable two-factor authentication (TOTP via authenticator app).

---

## Layout

Single scrollable page with five card sections. No tabs.

Route: `app/(dashboard)/dashboard/profile/page.tsx`

---

## Sections

### 1. General Information
Fields: `full_name`, `pronouns`, `bio`, `company`, `location`, `website`  
Email is displayed as a **read-only** field — users cannot change their email.  
Single "Save Changes" button per section.

### 2. Profile Photo
Upload or remove avatar image.  
Stored in **Supabase Storage** bucket: `avatars`.  
Path pattern: `avatars/{user_id}/avatar.{ext}`  
Constraints: JPG, PNG, or GIF · max 2 MB.  
On upload: old file is replaced. On remove: file deleted and `avatar_url` set to null.

### 3. Social Links
Seven platforms, each a free-text URL input (no validation beyond basic URL format):
- Twitter/X (`twitter_url`)
- LinkedIn (`linkedin_url`)
- GitHub (`github_url`)
- Instagram (`instagram_url`)
- Facebook (`facebook_url`)
- YouTube (`youtube_url`)
- TikTok (`tiktok_url`)

Single "Save Changes" button.

### 4. Security — Change Password
Fields: Current Password, New Password, Confirm New Password.  
Uses `supabase.auth.updateUser({ password })` after verifying current password via `supabase.auth.signInWithPassword`.  
Client-side: confirm new ≠ current, new === confirm before submitting.

### 5. Two-Factor Authentication
Authenticator app only (TOTP). Enforced on every login once enabled.

**Enable flow:**
1. User clicks "Enable 2FA"
2. Dialog opens — `supabase.auth.mfa.enroll({ factorType: 'totp' })` returns QR code URI + manual secret
3. User scans QR code with authenticator app (Google Authenticator, Authy, 1Password, etc.)
4. User enters 6-digit TOTP code
5. `supabase.auth.mfa.challenge()` + `supabase.auth.mfa.verify()` — on success, factor is enrolled
6. Dialog closes, badge updates to "Enabled"

**Disable flow:**
1. User clicks "Disable 2FA" → confirm dialog
2. `supabase.auth.mfa.unenroll({ factorId })` called
3. Badge updates to "Disabled"

**Login enforcement:**
- After password login, middleware checks session AAL (Assurance Level)
- If user has MFA enrolled and session AAL is `aal1`, redirect to `/auth/mfa`
- New page `app/auth/mfa/page.tsx`: user enters TOTP code → `supabase.auth.mfa.challenge()` + `supabase.auth.mfa.verify()` → session upgrades to `aal2` → redirect to `/dashboard`
- Users without MFA enrolled pass through normally

---

## Database Migration

File: `supabase/migrations/20260417000000_add_profile_fields.sql`

New columns added to `public.profiles`:

| Column | Type | Nullable |
|---|---|---|
| `bio` | text | yes |
| `pronouns` | text | yes |
| `company` | text | yes |
| `location` | text | yes |
| `website` | text | yes |
| `twitter_url` | text | yes |
| `linkedin_url` | text | yes |
| `github_url` | text | yes |
| `instagram_url` | text | yes |
| `facebook_url` | text | yes |
| `youtube_url` | text | yes |
| `tiktok_url` | text | yes |

2FA state is managed entirely by Supabase Auth MFA — no extra columns needed.

---

## Feature Module Structure

```
features/profile/
  actions.ts                  # updateProfile, updateAvatar, deleteAvatar, updatePassword
  types.ts                    # ProfileFormData, SocialLinksFormData
  components/
    GeneralInfoForm.tsx        # name, pronouns, bio, company, location, website, read-only email
    AvatarUpload.tsx           # photo upload/remove via Supabase Storage
    SocialLinksForm.tsx        # 7 social link inputs
    ChangePasswordForm.tsx     # current + new + confirm password
    TwoFactorSetup.tsx         # enable/disable TOTP with QR code dialog

app/(dashboard)/dashboard/profile/
  page.tsx                     # Server component — loads profile, renders all sections

app/auth/mfa/
  page.tsx                     # MFA challenge page — TOTP entry after password login

supabase/migrations/
  20260417000000_add_profile_fields.sql

lib/supabase/types.ts          # Profile type updated with new fields
```

---

## Sidebar

A "Profile" link added to the sidebar's user section — clicking the user's name/avatar area navigates to `/dashboard/profile`. A dedicated nav item (`UserCircle` icon) is also added to the main nav section so it's always visible.

---

## Server Actions

All profile mutations use Next.js server actions (`'use server'`):

| Action | Description |
|---|---|
| `updateProfile(data)` | Updates general info + social links on `profiles` table |
| `updateAvatar(file)` | Uploads to Supabase Storage, updates `avatar_url` |
| `deleteAvatar()` | Removes from Storage, sets `avatar_url` to null |
| `updatePassword(current, newPassword)` | Re-authenticates then calls `supabase.auth.updateUser` |

2FA actions are client-side only (direct Supabase Auth MFA API calls from `TwoFactorSetup.tsx`).

---

## Type System

`lib/supabase/types.ts` is manually maintained in this project. The `profiles` Row/Insert/Update types and the exported `Profile` type alias must be manually updated to include the 12 new columns after the migration is written.

---

## Auth Flow Change

`middleware.ts` (or the existing session check) updated to:
1. After confirming a valid session exists, call `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` which returns `{ currentLevel, nextLevel }`
2. If `nextLevel === 'aal2'` and `currentLevel === 'aal1'`, the user has MFA enrolled but hasn't completed the challenge — redirect to `/auth/mfa`
3. `/auth/mfa` is excluded from the redirect check to avoid redirect loops

---

## Out of Scope

- Email change (not supported — email is read-only)
- SMS / hardware key 2FA (authenticator app only)
- Backup codes for 2FA
- Public profile page (view-only profile for other users)
