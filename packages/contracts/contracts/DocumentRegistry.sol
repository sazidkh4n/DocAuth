// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./interfaces/IDocumentRegistry.sol";
import "./interfaces/IIssuerRegistry.sol";

contract DocumentRegistry is AccessControl, Pausable, EIP712, IDocumentRegistry {
    using ECDSA for bytes32;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant EMERGENCY_GUARDIAN_ROLE = keccak256("EMERGENCY_GUARDIAN_ROLE");

    bytes32 public constant ISSUE_CREDENTIAL_TYPEHASH = keccak256(
        "IssueCredential(bytes32 issuerId,bytes32 credentialId,bytes32 commitment,uint64 issuedAt,uint64 expiresAt,uint32 keyVersion,uint32 schemaVersion)"
    );

    bytes32 public constant REVOKE_CREDENTIAL_TYPEHASH = keccak256(
        "RevokeCredential(bytes32 credentialId,bytes32 reasonHash,uint64 revokedAt)"
    );

    IIssuerRegistry public immutable issuerRegistry;

    mapping(bytes32 => CredentialRecord) private _credentials;

    error IssuerNotActive(bytes32 issuerId);
    error CredentialAlreadyExists(bytes32 credentialId);
    error CredentialNotFound(bytes32 credentialId);
    error CredentialAlreadyRevoked(bytes32 credentialId);
    error SignerNotAuthorized(bytes32 issuerId, uint32 keyVersion, address recoveredSigner);
    error InvalidTimestamps();
    error InvalidCommitment();

    constructor(
        address defaultAdmin,
        address issuerRegistryAddress
    ) EIP712("DecentralizedDocumentPlatform", "1") {
        require(issuerRegistryAddress != address(0), "Invalid IssuerRegistry address");

        issuerRegistry = IIssuerRegistry(issuerRegistryAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, defaultAdmin);
        _grantRole(EMERGENCY_GUARDIAN_ROLE, defaultAdmin);
    }

    function issueCredential(
        IssueCredentialParams calldata params, 
        bytes calldata signature
    ) external override whenNotPaused {
        if (_credentials[params.credentialId].status != DocumentStatus.NONE) {
            revert CredentialAlreadyExists(params.credentialId);
        }
        if (params.commitment == bytes32(0)) {
            revert InvalidCommitment();
        }
        if (params.issuedAt > block.timestamp) {
            revert InvalidTimestamps();
        }
        if (params.expiresAt > 0 && params.expiresAt <= params.issuedAt) {
            revert InvalidTimestamps();
        }

        // 1. Check Issuer is currently ACTIVE
        if (!issuerRegistry.isIssuerActive(params.issuerId)) {
            revert IssuerNotActive(params.issuerId);
        }

        // 2. Compute EIP-712 digest and recover signer
        bytes32 structHash = keccak256(
            abi.encode(
                ISSUE_CREDENTIAL_TYPEHASH,
                params.issuerId,
                params.credentialId,
                params.commitment,
                params.issuedAt,
                params.expiresAt,
                params.keyVersion,
                params.schemaVersion
            )
        );

        bytes32 digest = _hashTypedDataV4(structHash);
        address recoveredSigner = digest.recover(signature);

        // 3. Verify recovered signer was authorized for issuer at issuedAt
        if (!issuerRegistry.isSigningKeyValid(params.issuerId, params.keyVersion, recoveredSigner, params.issuedAt)) {
            revert SignerNotAuthorized(params.issuerId, params.keyVersion, recoveredSigner);
        }

        // 4. Store credential record
        _credentials[params.credentialId] = CredentialRecord({
            issuerId: params.issuerId,
            commitment: params.commitment,
            issuedAt: params.issuedAt,
            expiresAt: params.expiresAt,
            keyVersion: params.keyVersion,
            status: DocumentStatus.ACTIVE
        });

        emit CredentialIssued(
            params.credentialId,
            params.issuerId,
            params.commitment,
            params.keyVersion,
            params.issuedAt,
            params.expiresAt
        );
    }

    function revokeCredential(
        bytes32 credentialId, 
        bytes32 reasonHash, 
        uint64 revokedAt, 
        bytes calldata signature
    ) external override whenNotPaused {
        CredentialRecord storage record = _credentials[credentialId];
        if (record.status == DocumentStatus.NONE) {
            revert CredentialNotFound(credentialId);
        }
        if (record.status == DocumentStatus.REVOKED) {
            revert CredentialAlreadyRevoked(credentialId);
        }

        // Emergency guardian bypasses signature
        if (!hasRole(EMERGENCY_GUARDIAN_ROLE, msg.sender)) {
            bytes32 structHash = keccak256(
                abi.encode(
                    REVOKE_CREDENTIAL_TYPEHASH,
                    credentialId,
                    reasonHash,
                    revokedAt
                )
            );

            bytes32 digest = _hashTypedDataV4(structHash);
            address recoveredSigner = digest.recover(signature);

            // Must be signed by an authorized key for this issuer
            if (!issuerRegistry.isSigningKeyValid(record.issuerId, record.keyVersion, recoveredSigner, revokedAt)) {
                revert SignerNotAuthorized(record.issuerId, record.keyVersion, recoveredSigner);
            }
        }

        record.status = DocumentStatus.REVOKED;

        emit CredentialRevoked(
            credentialId,
            record.issuerId,
            reasonHash,
            revokedAt
        );
    }

    function getCredential(bytes32 credentialId) external view override returns (CredentialRecord memory) {
        return _credentials[credentialId];
    }

    function getCredentialCommitment(bytes32 credentialId) external view override returns (bytes32) {
        return _credentials[credentialId].commitment;
    }

    function isCredentialActive(bytes32 credentialId) external view override returns (bool) {
        CredentialRecord storage record = _credentials[credentialId];
        if (record.status != DocumentStatus.ACTIVE) return false;
        if (record.expiresAt > 0 && block.timestamp >= record.expiresAt) return false;
        return true;
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}

