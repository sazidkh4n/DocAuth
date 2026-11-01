import { verifyTypedData } from 'ethers';
import type { IEip712Domain, IIssueCredentialPayload, IRevokeCredentialPayload } from '@docauth/shared';

export const EIP712_TYPES = {
  IssueCredential: [
    { name: 'issuerId', type: 'bytes32' },
    { name: 'credentialId', type: 'bytes32' },
    { name: 'commitment', type: 'bytes32' },
    { name: 'issuedAt', type: 'uint64' },
    { name: 'expiresAt', type: 'uint64' },
    { name: 'keyVersion', type: 'uint32' },
    { name: 'schemaVersion', type: 'uint32' },
  ],
  RevokeCredential: [
    { name: 'credentialId', type: 'bytes32' },
    { name: 'reasonHash', type: 'bytes32' },
    { name: 'revokedAt', type: 'uint64' },
  ],
};

/**
 * Recovers the Ethereum address that signed an IssueCredential EIP-712 payload.
 */
export function recoverIssuanceSigner(
  domain: IEip712Domain,
  payload: IIssueCredentialPayload,
  signature: string,
): string {
  return verifyTypedData(
    domain,
    { IssueCredential: EIP712_TYPES.IssueCredential },
    payload,
    signature,
  );
}

/**
 * Recovers the Ethereum address that signed a RevokeCredential EIP-712 payload.
 */
export function recoverRevocationSigner(
  domain: IEip712Domain,
  payload: IRevokeCredentialPayload,
  signature: string,
): string {
  return verifyTypedData(
    domain,
    { RevokeCredential: EIP712_TYPES.RevokeCredential },
    payload,
    signature,
  );
}
