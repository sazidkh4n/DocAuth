import { DocumentStatus, IssuerStatus, KeyStatus, VerificationStatus } from '../enums/index.js';

export interface IEip712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

export interface IIssueCredentialPayload {
  issuerId: string;       // 0x-prefixed 32-byte hex
  credentialId: string;   // 0x-prefixed 32-byte hex
  commitment: string;     // 0x-prefixed 32-byte hex
  issuedAt: number;       // Unix epoch timestamp in seconds
  expiresAt: number;      // Unix epoch timestamp in seconds (0 for no expiration)
  keyVersion: number;
  schemaVersion: number;
}

export interface IRevokeCredentialPayload {
  credentialId: string;
  reasonHash: string;
  revokedAt: number;
}

export interface ICredentialRecord {
  issuerId: string;
  commitment: string;
  issuedAt: number;
  expiresAt: number;
  keyVersion: number;
  status: DocumentStatus;
}

export interface IIssuerRecord {
  issuerId: string;
  status: IssuerStatus;
  registeredAt: number;
  activeKeyVersion: number;
}

export interface IIssuerKeyRecord {
  signerAddress: string;
  status: KeyStatus;
  effectiveAt: number;
  revokedAt: number;
  compromisedAt: number;
}

export interface IVerificationCheckDetail {
  status: 'PASSED' | 'FAILED' | 'WARNING' | 'SKIPPED';
  message: string;
  metadata?: Record<string, unknown>;
}

export interface IVerificationResult {
  status: VerificationStatus;
  verdict: string;
  credentialId?: string;
  documentHash?: string;
  checks: {
    documentIntegrity: IVerificationCheckDetail;
    issuerAuthenticity: IVerificationCheckDetail;
    organizationalTrust: IVerificationCheckDetail;
    lifecycle: IVerificationCheckDetail;
  };
  verifiedAt: string;
}

