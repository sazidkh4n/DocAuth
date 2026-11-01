// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IIssuerRegistry {
    enum IssuerStatus {
        NONE,
        ACTIVE,
        SUSPENDED,
        REVOKED
    }

    enum KeyStatus {
        NONE,
        ACTIVE,
        ROTATED,
        REVOKED,
        COMPROMISED
    }

    struct Issuer {
        bytes32 issuerId;
        IssuerStatus status;
        uint64 registeredAt;
        uint32 activeKeyVersion;
    }

    struct IssuerKey {
        address signerAddress;
        KeyStatus status;
        uint64 effectiveAt;
        uint64 revokedAt;
        uint64 compromisedAt;
    }

    event IssuerRegistered(bytes32 indexed issuerId, address indexed initialSigner, uint64 timestamp);
    event IssuerStatusChanged(bytes32 indexed issuerId, IssuerStatus previousStatus, IssuerStatus newStatus, uint64 timestamp);
    event SigningKeyAdded(bytes32 indexed issuerId, uint32 indexed keyVersion, address indexed signer, uint64 effectiveAt);
    event SigningKeyRevoked(bytes32 indexed issuerId, uint32 indexed keyVersion, uint64 revokedAt, uint64 compromisedAt);

    function registerIssuer(bytes32 issuerId, address initialSigner) external;
    function setIssuerStatus(bytes32 issuerId, IssuerStatus status) external;
    function rotateSigningKey(bytes32 issuerId, address newSigner) external returns (uint32);
    function revokeSigningKey(bytes32 issuerId, uint32 keyVersion, uint64 compromiseTime) external;

    function isIssuerActive(bytes32 issuerId) external view returns (bool);
    function isSigningKeyValid(bytes32 issuerId, uint32 keyVersion, address signer, uint64 atTimestamp) external view returns (bool);
    function getIssuer(bytes32 issuerId) external view returns (Issuer memory);
    function getSigningKey(bytes32 issuerId, uint32 keyVersion) external view returns (IssuerKey memory);
}

