import { expect } from 'chai';
import { ethers } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import { IssuerRegistry, DocumentRegistry } from '../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

describe('Decentralized Document Platform - Smart Contract Test Suite', () => {
  let admin: HardhatEthersSigner;
  let issuerManager: HardhatEthersSigner;
  let orgSignerV1: HardhatEthersSigner;
  let orgSignerV2: HardhatEthersSigner;
  let attacker: HardhatEthersSigner;
  let verifier: HardhatEthersSigner;

  let issuerRegistry: IssuerRegistry;
  let documentRegistry: DocumentRegistry;

  const sampleIssuerId = ethers.keccak256(ethers.toUtf8Bytes('UNIVERSITY_OF_TECHNOLOGY'));
  const sampleCredentialId = ethers.keccak256(ethers.toUtf8Bytes('DEGREE_ALICE_2026_001'));
  const sampleCommitment = ethers.keccak256(ethers.toUtf8Bytes('COMMITMENT_ALICE_DEGREE'));

  beforeEach(async () => {
    [admin, issuerManager, orgSignerV1, orgSignerV2, attacker, verifier] = await ethers.getSigners();

    // Deploy IssuerRegistry
    const IssuerRegistryFactory = await ethers.getContractFactory('IssuerRegistry');
    issuerRegistry = await IssuerRegistryFactory.deploy(admin.address, issuerManager.address);
    await issuerRegistry.waitForDeployment();

    // Deploy DocumentRegistry
    const DocumentRegistryFactory = await ethers.getContractFactory('DocumentRegistry');
    documentRegistry = await DocumentRegistryFactory.deploy(admin.address, await issuerRegistry.getAddress());
    await documentRegistry.waitForDeployment();
  });

  describe('1. IssuerRegistry Tests', () => {
    it('should initialize with correct roles', async () => {
      const DEFAULT_ADMIN_ROLE = await issuerRegistry.DEFAULT_ADMIN_ROLE();
      const ISSUER_MANAGER_ROLE = await issuerRegistry.ISSUER_MANAGER_ROLE();

      expect(await issuerRegistry.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await issuerRegistry.hasRole(ISSUER_MANAGER_ROLE, issuerManager.address)).to.be.true;
    });

    it('should register an issuer and initial signing key', async () => {
      await expect(issuerRegistry.connect(issuerManager).registerIssuer(sampleIssuerId, orgSignerV1.address))
        .to.emit(issuerRegistry, 'IssuerRegistered')
        .and.to.emit(issuerRegistry, 'SigningKeyAdded');

      expect(await issuerRegistry.isIssuerActive(sampleIssuerId)).to.be.true;

      const now = await time.latest();
      expect(await issuerRegistry.isSigningKeyValid(sampleIssuerId, 1, orgSignerV1.address, now)).to.be.true;
      expect(await issuerRegistry.isSigningKeyValid(sampleIssuerId, 1, attacker.address, now)).to.be.false;
    });

    it('should prevent non-manager from registering issuer', async () => {
      await expect(
        issuerRegistry.connect(attacker).registerIssuer(sampleIssuerId, orgSignerV1.address)
      ).to.be.revertedWithCustomError(issuerRegistry, 'AccessControlUnauthorizedAccount');
    });

    it('should rotate signing key and update active version', async () => {
      await issuerRegistry.connect(issuerManager).registerIssuer(sampleIssuerId, orgSignerV1.address);

      await expect(issuerRegistry.connect(issuerManager).rotateSigningKey(sampleIssuerId, orgSignerV2.address))
        .to.emit(issuerRegistry, 'SigningKeyAdded')
        .withArgs(sampleIssuerId, 2, orgSignerV2.address, (await time.latest()) + 1);

      const issuer = await issuerRegistry.getIssuer(sampleIssuerId);
      expect(issuer.activeKeyVersion).to.equal(2);

      const now = await time.latest();
      expect(await issuerRegistry.isSigningKeyValid(sampleIssuerId, 2, orgSignerV2.address, now)).to.be.true;
    });

    it('should handle compromised keys with historical timestamp protection', async () => {
      await issuerRegistry.connect(issuerManager).registerIssuer(sampleIssuerId, orgSignerV1.address);
      const registrationTime = await time.latest();

      // Fast forward 10 days
      await time.increase(10 * 86400);
      const compromiseTime = await time.latest();

      // Revoke as compromised at compromiseTime
      await issuerRegistry.connect(issuerManager).revokeSigningKey(sampleIssuerId, 1, compromiseTime);

      // Past check before compromise should be valid
      expect(await issuerRegistry.isSigningKeyValid(sampleIssuerId, 1, orgSignerV1.address, registrationTime)).to.be.true;

      // Post-compromise check should be invalid
      expect(await issuerRegistry.isSigningKeyValid(sampleIssuerId, 1, orgSignerV1.address, compromiseTime + 100)).to.be.false;
    });
  });

  describe('2. DocumentRegistry Tests with EIP-712 Signatures', () => {
    let domain: {
      name: string;
      version: string;
      chainId: number;
      verifyingContract: string;
    };

    const types = {
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

    beforeEach(async () => {
      await issuerRegistry.connect(issuerManager).registerIssuer(sampleIssuerId, orgSignerV1.address);

      const network = await ethers.provider.getNetwork();
      domain = {
        name: 'DecentralizedDocumentPlatform',
        version: '1',
        chainId: Number(network.chainId),
        verifyingContract: await documentRegistry.getAddress(),
      };
    });

    it('should issue a credential with a valid EIP-712 signature from authorized signer', async () => {
      const issuedAt = await time.latest();
      const expiresAt = 0; // No expiration

      const params = {
        issuerId: sampleIssuerId,
        credentialId: sampleCredentialId,
        commitment: sampleCommitment,
        issuedAt,
        expiresAt,
        keyVersion: 1,
        schemaVersion: 1,
      };

      const signature = await orgSignerV1.signTypedData(domain, { IssueCredential: types.IssueCredential }, params);

      // Any relayer can submit the transaction
      await expect(documentRegistry.connect(verifier).issueCredential(params, signature))
        .to.emit(documentRegistry, 'CredentialIssued')
        .withArgs(sampleCredentialId, sampleIssuerId, sampleCommitment, 1, issuedAt, expiresAt);

      expect(await documentRegistry.isCredentialActive(sampleCredentialId)).to.be.true;
      expect(await documentRegistry.getCredentialCommitment(sampleCredentialId)).to.equal(sampleCommitment);
    });

    it('should reject issuance if signature is from unauthorized attacker', async () => {
      const issuedAt = await time.latest();
      const params = {
        issuerId: sampleIssuerId,
        credentialId: sampleCredentialId,
        commitment: sampleCommitment,
        issuedAt,
        expiresAt: 0,
        keyVersion: 1,
        schemaVersion: 1,
      };

      // Attacker signs instead of orgSignerV1
      const forgedSignature = await attacker.signTypedData(domain, { IssueCredential: types.IssueCredential }, params);

      await expect(
        documentRegistry.connect(verifier).issueCredential(params, forgedSignature)
      ).to.be.revertedWithCustomError(documentRegistry, 'SignerNotAuthorized');
    });

    it('should reject duplicate credentialId (anti-replay)', async () => {
      const issuedAt = await time.latest();
      const params = {
        issuerId: sampleIssuerId,
        credentialId: sampleCredentialId,
        commitment: sampleCommitment,
        issuedAt,
        expiresAt: 0,
        keyVersion: 1,
        schemaVersion: 1,
      };

      const signature = await orgSignerV1.signTypedData(domain, { IssueCredential: types.IssueCredential }, params);
      await documentRegistry.connect(verifier).issueCredential(params, signature);

      // Attempt duplicate submission
      await expect(
        documentRegistry.connect(verifier).issueCredential(params, signature)
      ).to.be.revertedWithCustomError(documentRegistry, 'CredentialAlreadyExists');
    });

    it('should reject issuance if issuer is suspended', async () => {
      await issuerRegistry.connect(issuerManager).setIssuerStatus(sampleIssuerId, 2); // 2 = SUSPENDED

      const issuedAt = await time.latest();
      const params = {
        issuerId: sampleIssuerId,
        credentialId: sampleCredentialId,
        commitment: sampleCommitment,
        issuedAt,
        expiresAt: 0,
        keyVersion: 1,
        schemaVersion: 1,
      };

      const signature = await orgSignerV1.signTypedData(domain, { IssueCredential: types.IssueCredential }, params);

      await expect(
        documentRegistry.connect(verifier).issueCredential(params, signature)
      ).to.be.revertedWithCustomError(documentRegistry, 'IssuerNotActive');
    });

    it('should revoke a credential with authorized signature', async () => {
      const issuedAt = await time.latest();
      const params = {
        issuerId: sampleIssuerId,
        credentialId: sampleCredentialId,
        commitment: sampleCommitment,
        issuedAt,
        expiresAt: 0,
        keyVersion: 1,
        schemaVersion: 1,
      };

      const signature = await orgSignerV1.signTypedData(domain, { IssueCredential: types.IssueCredential }, params);
      await documentRegistry.connect(verifier).issueCredential(params, signature);

      const revokedAt = (await time.latest()) + 1;
      const reasonHash = ethers.keccak256(ethers.toUtf8Bytes('Holder misconduct'));

      const revokeParams = {
        credentialId: sampleCredentialId,
        reasonHash,
        revokedAt,
      };

      const revokeSignature = await orgSignerV1.signTypedData(domain, { RevokeCredential: types.RevokeCredential }, revokeParams);

      await expect(documentRegistry.connect(verifier).revokeCredential(sampleCredentialId, reasonHash, revokedAt, revokeSignature))
        .to.emit(documentRegistry, 'CredentialRevoked')
        .withArgs(sampleCredentialId, sampleIssuerId, reasonHash, revokedAt);

      expect(await documentRegistry.isCredentialActive(sampleCredentialId)).to.be.false;

      const record = await documentRegistry.getCredential(sampleCredentialId);
      expect(record.status).to.equal(2); // REVOKED
    });
  });
});

