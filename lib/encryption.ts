import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const secret = process.env.LLM_KEY_ENCRYPTION_SECRET
  if (!secret || secret.length !== 32) {
    throw new Error('LLM_KEY_ENCRYPTION_SECRET must be exactly 32 characters')
  }
  return Buffer.from(secret, 'utf8')
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns a colon-separated string: base64(iv):base64(authTag):base64(ciphertext)
 */
export function encryptSecret(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12) // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

/**
 * Decrypts a string produced by encryptSecret.
 * Throws if the ciphertext is tampered or the key is wrong.
 */
export function decryptSecret(ciphertext: string): string {
  const key = getKey()
  const [ivB64, authTagB64, encryptedB64] = ciphertext.split(':')

  if (!ivB64 || !authTagB64 || !encryptedB64) {
    throw new Error('Invalid ciphertext format')
  }

  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')
  const encrypted = Buffer.from(encryptedB64, 'base64')

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  return decipher.update(encrypted) + decipher.final('utf8')
}
