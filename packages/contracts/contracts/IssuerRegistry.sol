// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IIssuerRegistry.sol";

contract IssuerRegistry is AccessControl, Pausable, IIssuerRegistry {
    bytes32 public constant ISSUER_MANAGER_ROLE = keccak256("ISSUER_MANAGER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    mapping(bytes32 => Issuer) private _issuers;
    mapping(bytes32 => mapping(uint32 => IssuerKey)) private _issuerKeys;
    mapping(bytes32 => uint32) private _latestKeyVersions;

    error IssuerAlreadyExists(bytes32 issuerId);
    error IssuerNotFound(bytes32 issuerId);
    error InvalidSignerAddress();
    error KeyVersionNotFound(bytes32 issuerId, uint32 keyVersion);
    error KeyAlreadyRevoked(bytes32 issuerId, uint32 keyVersion);

    constructor(address defaultAdmin, address issuerManager) {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(ISSUER_MANAGER_ROLE, issuerManager);
        _grantRole(PAUSER_ROLE, defaultAdmin);
    }

    function registerIssuer(bytes32 issuerId, address initialSigner) 
        external 
        override 
        onlyRole(ISSUER_MANAGER_ROLE) 
        whenNotPaused 
    {
        if (issuerId == bytes32(0)) revert IssuerNotFound(issuerId);
        if (_issuers[issuerId].status != IssuerStatus.NONE) revert IssuerAlreadyExists(issuerId);
        if (initialSigner == address(0)) revert InvalidSignerAddress();

        uint64 currentTime = uint64(block.timestamp);

        _issuers[issuerId] = Issuer({
            issuerId: issuerId,
            status: IssuerStatus.ACTIVE,
            registeredAt: currentTime,
            activeKeyVersion: 1
        });

        _issuerKeys[issuerId][1] = IssuerKey({
            signerAddress: initialSigner,
            status: KeyStatus.ACTIVE,
            effectiveAt: currentTime,
            revokedAt: 0,
            compromisedAt: 0
        });

        _latestKeyVersions[issuerId] = 1;

        emit IssuerRegistered(issuerId, initialSigner, currentTime);
        emit SigningKeyAdded(issuerId, 1, initialSigner, currentTime);
    }

    function setIssuerStatus(bytes32 issuerId, IssuerStatus status) 
        external 
        override 
        onlyRole(ISSUER_MANAGER_ROLE) 
    {
        Issuer storage issuer = _issuers[issuerId];
        if (issuer.status == IssuerStatus.NONE) revert IssuerNotFound(issuerId);

        IssuerStatus previous = issuer.status;
        issuer.status = status;

        emit IssuerStatusChanged(issuerId, previous, status, uint64(block.timestamp));
    }

    function rotateSigningKey(bytes32 issuerId, address newSigner) 
        external 
        override 
        onlyRole(ISSUER_MANAGER_ROLE) 
        whenNotPaused 
        returns (uint32 newVersion) 
    {
        Issuer storage issuer = _issuers[issuerId];
        if (issuer.status == IssuerStatus.NONE) revert IssuerNotFound(issuerId);
        if (newSigner == address(0)) revert InvalidSignerAddress();

        uint32 currentVersion = _latestKeyVersions[issuerId];
        IssuerKey storage previousKey = _issuerKeys[issuerId][currentVersion];
        if (previousKey.status == KeyStatus.ACTIVE) {
            previousKey.status = KeyStatus.ROTATED;
        }

        newVersion = currentVersion + 1;
        uint64 currentTime = uint64(block.timestamp);

        _issuerKeys[issuerId][newVersion] = IssuerKey({
            signerAddress: newSigner,
            status: KeyStatus.ACTIVE,
            effectiveAt: currentTime,
            revokedAt: 0,
            compromisedAt: 0
        });

        _latestKeyVersions[issuerId] = newVersion;
        issuer.activeKeyVersion = newVersion;

        emit SigningKeyAdded(issuerId, newVersion, newSigner, currentTime);
    }

    function revokeSigningKey(bytes32 issuerId, uint32 keyVersion, uint64 compromiseTime) 
        external 
        override 
        onlyRole(ISSUER_MANAGER_ROLE) 
    {
        Issuer storage issuer = _issuers[issuerId];
        if (issuer.status == IssuerStatus.NONE) revert IssuerNotFound(issuerId);

        IssuerKey storage key = _issuerKeys[issuerId][keyVersion];
        if (key.signerAddress == address(0)) revert KeyVersionNotFound(issuerId, keyVersion);
        if (key.status == KeyStatus.REVOKED || key.status == KeyStatus.COMPROMISED) {
            revert KeyAlreadyRevoked(issuerId, keyVersion);
        }

        uint64 currentTime = uint64(block.timestamp);
        key.revokedAt = currentTime;

        if (compromiseTime > 0) {
            key.status = KeyStatus.COMPROMISED;
            key.compromisedAt = compromiseTime;
        } else {
            key.status = KeyStatus.REVOKED;
        }

        emit SigningKeyRevoked(issuerId, keyVersion, currentTime, compromiseTime);
    }

    function isIssuerActive(bytes32 issuerId) external view override returns (bool) {
        return _issuers[issuerId].status == IssuerStatus.ACTIVE;
    }

    function isSigningKeyValid(
        bytes32 issuerId, 
        uint32 keyVersion, 
        address signer, 
        uint64 atTimestamp
    ) external view override returns (bool) {
        Issuer storage issuer = _issuers[issuerId];
        if (issuer.status == IssuerStatus.NONE) return false;

        IssuerKey storage key = _issuerKeys[issuerId][keyVersion];
        if (key.signerAddress == address(0) || key.signerAddress != signer) return false;
        if (atTimestamp < key.effectiveAt) return false;

        if (key.status == KeyStatus.COMPROMISED) {
            return atTimestamp < key.compromisedAt;
        }

        if (key.status == KeyStatus.REVOKED) {
            return atTimestamp <= key.revokedAt;
        }

        return true;
    }

    function getIssuer(bytes32 issuerId) external view override returns (Issuer memory) {
        return _issuers[issuerId];
    }

    function getSigningKey(bytes32 issuerId, uint32 keyVersion) external view override returns (IssuerKey memory) {
        return _issuerKeys[issuerId][keyVersion];
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}

