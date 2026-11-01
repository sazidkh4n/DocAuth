import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';

/**
 * Computes authoritative SHA-256 fingerprint on raw byte stream.
 * Produces 0x-prefixed 64-char hex string (32 bytes).
 */
export async function calculateSha256(input: Buffer | Readable): Promise<string> {
  const hash = createHash('sha256');

  if (Buffer.isBuffer(input)) {
    hash.update(input);
    return `0x${hash.digest('hex')}`;
  }

  return new Promise((resolve, reject) => {
    input.on('data', (chunk) => hash.update(chunk));
    input.on('end', () => resolve(`0x${hash.digest('hex')}`));
    input.on('error', (err) => reject(err));
  });
}

/**
 * Synchronous SHA-256 byte hashing for buffers.
 */
export function calculateSha256Sync(buffer: Buffer): string {
  const hash = createHash('sha256');
  hash.update(buffer);
  return `0x${hash.digest('hex')}`;
}

