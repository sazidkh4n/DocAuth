import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';
import {
  calculateSha256Sync,
  generateCredentialId,
  generateNonce,
  generateIssuerId,
  calculateCommitment,
  generateHmacLookup,
  encryptAesGcm,
  decryptAesGcm,
  encryptFileEnvelope,
  decryptFileEnvelope,
  recoverIssuanceSigner,
  EIP712_TYPES,
} from './index.js';

test('Cryptographic Suite - SHA-256 Byte Hashing', () => {
  const originalBytes = Buffer.from('PDF Content for Rahul Sharma - Junior Developer 2024-2026');
  const modifiedBytes = Buffer.from('PDF Content for Rahul Sharma - Senior Developer 2023-2026');

  const originalHash = calculateSha256Sync(originalBytes);
  const modifiedHash = calculateSha256Sync(modifiedBytes);

  assert.match(originalHash, /^0x[0-9a-f]{64}$/);
  assert.match(modifiedHash, /^0x[0-9a-f]{64}$/);
  assert.notEqual(originalHash, modifiedHash, 'Single character modification must yield distinct SHA-256');
});

test('Cryptographic Suite - Nonce & Identifier Generation', () => {
  const nonce = generateNonce();
  const credId = generateCredentialId();
  const issuerId = generateIssuerId();

  assert.match(nonce, /^0x[0-9a-f]{64}$/);
  assert.match(credId, /^0x[0-9a-f]{64}$/);
  assert.match(issuerId, /^0x[0-9a-f]{64}$/);
  assert.notEqual(nonce, credId);
});

test('Cryptographic Suite - Privacy-Preserving Commitment Calculation', () => {
  const credId = generateCredentialId();
  const issuerId = generateIssuerId();
  const nonce = generateNonce();
  const originalHash = calculateSha256Sync(Buffer.from('Original Degree Document'));
  const modifiedHash = calculateSha256Sync(Buffer.from('Modified Degree Document'));

  const commitmentOriginal = calculateCommitment(1, credId, issuerId, originalHash, nonce);
  const commitmentModified = calculateCommitment(1, credId, issuerId, modifiedHash, nonce);

  assert.match(commitmentOriginal, /^0x[0-9a-f]{64}$/);
  assert.match(commitmentModified, /^0x[0-9a-f]{64}$/);
  assert.notEqual(commitmentOriginal, commitmentModified, 'Commitment must change when document hash changes');

  // Determinism check
  const commitmentCheck = calculateCommitment(1, credId, issuerId, originalHash, nonce);
  assert.equal(commitmentOriginal, commitmentCheck, 'Commitment calculation must be strictly deterministic');
});

test('Cryptographic Suite - HMAC Lookup Index', () => {
  const secretKey = 'super-secret-hmac-key';
  const docHash = calculateSha256Sync(Buffer.from('Document'));

  const index1 = generateHmacLookup(docHash, secretKey);
  const index2 = generateHmacLookup(docHash, secretKey);
  const indexDifferentSecret = generateHmacLookup(docHash, 'other-secret');

  assert.equal(index1, index2);
  assert.notEqual(index1, indexDifferentSecret);
  assert.equal(index1.length, 64);
});

test('Cryptographic Suite - AES-256-GCM Envelope Encryption Round-Trip', () => {
  const masterKekHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const fileContent = Buffer.from('CONFIDENTIAL EMPLOYMENT VERIFICATION LETTER - EXACT BYTES PRESERVED');

  // 1. Basic text encryption
  const encText = encryptAesGcm('Secret Nonce 12345', masterKekHex);
  const decText = decryptAesGcm(encText, masterKekHex).toString('utf-8');
  assert.equal(decText, 'Secret Nonce 12345');

  // 2. File envelope encryption
  const envelope = encryptFileEnvelope(fileContent, masterKekHex);
  assert.ok(envelope.encryptedDek.ciphertext);
  assert.ok(envelope.encryptedFile.ciphertext);

  const decryptedFile = decryptFileEnvelope(envelope, masterKekHex);
  assert.deepEqual(decryptedFile, fileContent, 'Decrypted file bytes must identically match original file bytes');
});

test('Cryptographic Suite - EIP-712 Signer Recovery', async () => {
  const wallet = Wallet.createRandom();
  const domain = {
    name: 'DecentralizedDocumentPlatform',
    version: '1',
    chainId: 80002,
    verifyingContract: '0x1234567890123456789012345678901234567890',
  };

  const payload = {
    issuerId: generateIssuerId(),
    credentialId: generateCredentialId(),
    commitment: calculateCommitment(1, generateCredentialId(), generateIssuerId(), generateNonce(), generateNonce()),
    issuedAt: Math.floor(Date.now() / 1000),
    expiresAt: 0,
    keyVersion: 1,
    schemaVersion: 1,
  };

  const signature = await wallet.signTypedData(
    domain,
    { IssueCredential: EIP712_TYPES.IssueCredential },
    payload,
  );

  const recovered = recoverIssuanceSigner(domain, payload, signature);
  assert.equal(recovered.toLowerCase(), wallet.address.toLowerCase(), 'Recovered signer must match authorized wallet');
});

