import { JsonRpcProvider, Contract, Wallet } from 'ethers';

export const ISSUER_REGISTRY_ABI = [
  'function registerIssuer(bytes32 issuerId, address initialSigner) external',
  'function setIssuerStatus(bytes32 issuerId, uint8 status) external',
  'function rotateSigningKey(bytes32 issuerId, address newSigner) external returns (uint32)',
  'function revokeSigningKey(bytes32 issuerId, uint32 keyVersion, uint64 compromiseTime) external',
  'function isIssuerActive(bytes32 issuerId) external view returns (bool)',
  'function isSigningKeyValid(bytes32 issuerId, uint32 keyVersion, address signer, uint64 atTimestamp) external view returns (bool)',
  'function getIssuer(bytes32 issuerId) external view returns (tuple(bytes32 issuerId, uint8 status, uint64 registeredAt, uint32 activeKeyVersion))',
  'function getSigningKey(bytes32 issuerId, uint32 keyVersion) external view returns (tuple(address signerAddress, uint8 status, uint64 effectiveAt, uint64 revokedAt, uint64 compromisedAt))',
  'event IssuerRegistered(bytes32 indexed issuerId, address indexed initialSigner, uint64 timestamp)',
  'event IssuerStatusChanged(bytes32 indexed issuerId, uint8 previousStatus, uint8 newStatus, uint64 timestamp)',
  'event SigningKeyAdded(bytes32 indexed issuerId, uint32 indexed keyVersion, address indexed signer, uint64 effectiveAt)',
  'event SigningKeyRevoked(bytes32 indexed issuerId, uint32 indexed keyVersion, uint64 revokedAt, uint64 compromisedAt)',
];

export const DOCUMENT_REGISTRY_ABI = [
  'function issueCredential(tuple(bytes32 issuerId, bytes32 credentialId, bytes32 commitment, uint64 issuedAt, uint64 expiresAt, uint32 keyVersion, uint32 schemaVersion) params, bytes signature) external',
  'function revokeCredential(bytes32 credentialId, bytes32 reasonHash, uint64 revokedAt, bytes signature) external',
  'function getCredential(bytes32 credentialId) external view returns (tuple(bytes32 issuerId, bytes32 commitment, uint64 issuedAt, uint64 expiresAt, uint32 keyVersion, uint8 status))',
  'function getCredentialCommitment(bytes32 credentialId) external view returns (bytes32)',
  'function isCredentialActive(bytes32 credentialId) external view returns (bool)',
  'event CredentialIssued(bytes32 indexed credentialId, bytes32 indexed issuerId, bytes32 commitment, uint32 keyVersion, uint64 issuedAt, uint64 expiresAt)',
  'event CredentialRevoked(bytes32 indexed credentialId, bytes32 indexed issuerId, bytes32 reasonHash, uint64 revokedAt)',
];

export class PolygonBlockchainClient {
  public readonly provider: JsonRpcProvider;

  constructor(rpcUrl: string, chainId?: number) {
    this.provider = new JsonRpcProvider(rpcUrl, chainId ? { chainId, name: 'polygon' } : undefined);
  }

  getIssuerRegistry(address: string, signer?: Wallet): Contract {
    return new Contract(address, ISSUER_REGISTRY_ABI, signer ? signer.connect(this.provider) : this.provider);
  }

  getDocumentRegistry(address: string, signer?: Wallet): Contract {
    return new Contract(address, DOCUMENT_REGISTRY_ABI, signer ? signer.connect(this.provider) : this.provider);
  }

  async getLatestBlockNumber(): Promise<number> {
    return await this.provider.getBlockNumber();
  }
}

