import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes is the standard IV length for GCM
const AUTH_TAG_LENGTH = 16; // 16 bytes (128-bit) auth tag
const KEY_HEX_LENGTH = 64; // 32 bytes = 64 hex characters

/**
 * PII fields on employee records that must be encrypted at rest.
 * Referenced by Prisma middleware and API route handlers.
 */
export const SENSITIVE_EMPLOYEE_FIELDS = ['ssn', 'aadhaarNumber', 'panNumber'] as const;

// ---------------------------------------------------------------------------
// Key management (lazy singleton)
// ---------------------------------------------------------------------------

let _cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (_cachedKey) return _cachedKey;

  const raw = process.env.ENCRYPTION_KEY;

  if (!raw) {
    throw new Error(
      'ENCRYPTION_KEY is not set. Add a 64-character hex string to your .env.local file. ' +
        'Generate one with: openssl rand -hex 32',
    );
  }

  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error(
      `ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Received ${raw.length} characters.`,
    );
  }

  _cachedKey = Buffer.from(raw, 'hex');
  return _cachedKey;
}

// ---------------------------------------------------------------------------
// Core encrypt / decrypt
// ---------------------------------------------------------------------------

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * Returns a base64-encoded string containing `iv (12 B) + authTag (16 B) + ciphertext`.
 * A fresh random IV is generated for every call, so encrypting the same plaintext
 * twice produces different outputs.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Pack: iv + authTag + ciphertext
  const packed = Buffer.concat([iv, authTag, encrypted]);
  return packed.toString('base64');
}

/**
 * Decrypt a value previously produced by `encrypt()`.
 *
 * Throws an error if the data has been tampered with or the wrong key is used.
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const packed = Buffer.from(ciphertext, 'base64');

  if (packed.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted payload: too short to contain IV + auth tag.');
  }

  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

// ---------------------------------------------------------------------------
// Object-level helpers
// ---------------------------------------------------------------------------

/**
 * Return a shallow copy of `data` with the specified fields encrypted.
 * Non-string fields are left untouched.
 */
export function encryptFields<T extends Record<string, unknown>>(
  data: T,
  fieldNames: (keyof T)[],
): T {
  const result = { ...data };

  for (const field of fieldNames) {
    const value = result[field];
    if (typeof value === 'string') {
      (result as Record<string, unknown>)[field as string] = encrypt(value);
    }
  }

  return result;
}

/**
 * Return a shallow copy of `data` with the specified fields decrypted.
 * Non-string fields are left untouched. If decryption fails for a field
 * (wrong key, corrupted data, or the value was never encrypted), the
 * original value is preserved so callers can degrade gracefully.
 */
export function decryptFields<T extends Record<string, unknown>>(
  data: T,
  fieldNames: (keyof T)[],
): T {
  const result = { ...data };

  for (const field of fieldNames) {
    const value = result[field];
    if (typeof value === 'string') {
      try {
        (result as Record<string, unknown>)[field as string] = decrypt(value);
      } catch {
        // Leave as-is — value may be unencrypted or corrupted.
      }
    }
  }

  return result;
}
