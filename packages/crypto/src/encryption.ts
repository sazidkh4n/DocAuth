import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface IEncryptedPayload {
  iv: string;         // Hex 12 bytes
  authTag: string;    // Hex 16 bytes
  ciphertext: string; // Hex or Base64
}

export interface IEnvelopeEncryptedFile {
  encryptedDek: IEncryptedPayload;
  encryptedFile: IEncryptedPayload;
}

/**
 * Encrypts a string or buffer using AES-256-GCM with a 32-byte key.
 */
export function encryptAesGcm(data: Buffer | string, keyHex: string): IEncryptedPayload {
  const key = Buffer.from(keyHex.replace(/^0x/, ''), 'hex');
  if (key.length !== 32) {
    throw new Error('Encryption key must be exactly 32 bytes (64 hex characters)');
  }

  const iv = randomBytes(12); // Recommended 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const inputBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');
  const ciphertext = Buffer.concat([cipher.update(inputBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    ciphertext: ciphertext.toString('hex'),
  };
}

/**
 * Decrypts AES-256-GCM payload.
 */
export function decryptAesGcm(payload: IEncryptedPayload, keyHex: string): Buffer {
  const key = Buffer.from(keyHex.replace(/^0x/, ''), 'hex');
  if (key.length !== 32) {
    throw new Error('Encryption key must be exactly 32 bytes (64 hex characters)');
  }

  const iv = Buffer.from(payload.iv, 'hex');
  const authTag = Buffer.from(payload.authTag, 'hex');
  const ciphertext = Buffer.from(payload.ciphertext, 'hex');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Performs Envelope Encryption on a file buffer using a master Key Encryption Key (KEK).
 * Generates an ephemeral Data Encryption Key (DEK), encrypts the file with the DEK,
 * and encrypts the DEK with the master KEK.
 */
export function encryptFileEnvelope(fileBuffer: Buffer, kekHex: string): IEnvelopeEncryptedFile {
  // 1. Generate unique 256-bit DEK
  const dek = randomBytes(32);
  const dekHex = dek.toString('hex');

  // 2. Encrypt file with DEK
  const encryptedFile = encryptAesGcm(fileBuffer, dekHex);

  // 3. Encrypt DEK with KEK
  const encryptedDek = encryptAesGcm(dek, kekHex);

  return {
    encryptedDek,
    encryptedFile,
  };
}

/**
 * Decrypts an envelope-encrypted file using the master KEK.
 */
export function decryptFileEnvelope(envelope: IEnvelopeEncryptedFile, kekHex: string): Buffer {
  // 1. Decrypt DEK with master KEK
  const dek = decryptAesGcm(envelope.encryptedDek, kekHex);
  const dekHex = dek.toString('hex');

  // 2. Decrypt file with decrypted DEK
  return decryptAesGcm(envelope.encryptedFile, dekHex);
}

