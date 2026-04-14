import { NextRequest } from 'next/server'
import { validateApiKey } from '@/features/api-keys/apiKeyService'

export type ApiAuthResult =
  | { success: true; userId: string }
  | { success: false; error: string; status: 401 }

export async function requireApiKey(req: NextRequest | Request): Promise<ApiAuthResult> {
  const authHeader = req.headers.get('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      success: false,
      error: 'Missing Authorization header. Expected: Bearer <api_key>',
      status: 401,
    }
  }

  const token = authHeader.slice(7).trim()
  const userId = await validateApiKey(token)

  if (!userId) {
    return { success: false, error: 'Invalid or revoked API key.', status: 401 }
  }

  return { success: true, userId }
}
