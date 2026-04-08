export type ApiKey = {
  id: string
  name: string
  key_hash: string
  key_preview: string
  user_id: string
  created_at: string | null
  last_used_at: string | null
  is_active: boolean
}

export type ApiKeyListItem = Omit<ApiKey, 'key_hash'>

export type CreateApiKeyResult = {
  key: ApiKeyListItem
  rawKey: string
}
