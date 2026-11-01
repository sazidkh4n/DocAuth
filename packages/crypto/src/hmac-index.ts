import { createHmac } from 'node:crypto';

/**
 * Computes a keyed HMAC-SHA256 lookup index from a document hash.
 * This enables searching for an existing document without exposing the plaintext hash in the database.
 * 
 * @param documentHash 0x-prefixed or bare hex string
 * @param hmacSecret Key managed outside the database
 * @returns 64-character hex lookup string
 */
export function generateHmacLookup(documentHash: string, hmacSecret: string): string {
  const normalizedHash = documentHash.startsWith('0x') ? documentHash.slice(2) : documentHash;
  return createHmac('sha256', hmacSecret).update(normalizedHash).digest('hex');
}

