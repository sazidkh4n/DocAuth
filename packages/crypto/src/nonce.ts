import { randomBytes } from 'node:crypto';

/**
 * Generates a cryptographically secure 32-byte nonce (0x-prefixed hex).
 */
export function generateNonce(): string {
  return `0x${randomBytes(32).toString('hex')}`;
}

/**
 * Generates a cryptographically secure unique 32-byte credential ID (0x-prefixed hex).
 */
export function generateCredentialId(): string {
  return `0x${randomBytes(32).toString('hex')}`;
}

/**
 * Generates a cryptographically secure unique 32-byte issuer ID (0x-prefixed hex).
 */
export function generateIssuerId(): string {
  return `0x${randomBytes(32).toString('hex')}`;
}

