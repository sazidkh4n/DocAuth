// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IDocumentRegistry {
    enum DocumentStatus {
        NONE,
        ACTIVE,
        REVOKED
    }

    struct CredentialRecord {
        bytes32 issuerId;
        bytes32 commitment;
        uint64 issuedAt;
        uint64 expiresAt;
        uint32 keyVersion;
        DocumentStatus status;
    }

    struct IssueCredentialParams {
        bytes32 issuerId;
        bytes32 credentialId;
        bytes32 commitment;
        uint64 issuedAt;
        uint64 expiresAt;
        uint32 keyVersion;
        uint32 schemaVersion;
    }

    event CredentialIssued(
        bytes32 indexed credentialId,
        bytes32 indexed issuerId,
        bytes32 commitment,
        uint32 keyVersion,
        uint64 issuedAt,
        uint64 expiresAt
    );

    event CredentialRevoked(
        bytes32 indexed credentialId,
        bytes32 indexed issuerId,
        bytes32 reasonHash,
        uint64 revokedAt
    );

    function issueCredential(IssueCredentialParams calldata params, bytes calldata signature) external;
    function revokeCredential(bytes32 credentialId, bytes32 reasonHash, uint64 revokedAt, bytes calldata signature) external;

    function getCredential(bytes32 credentialId) external view returns (CredentialRecord memory);
    function getCredentialCommitment(bytes32 credentialId) external view returns (bytes32);
    function isCredentialActive(bytes32 credentialId) external view returns (bool);
}

