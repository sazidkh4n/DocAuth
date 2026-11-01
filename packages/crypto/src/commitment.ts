import { AbiCoder, keccak256 } from 'ethers';

const abiCoder = AbiCoder.defaultAbiCoder();

/**
 * Calculates privacy-preserving Keccak-256 commitment using standardized Solidity ABI encoding.
 * 
 * In Solidity:
 * commitment = keccak256(abi.encode(commitmentVersion, credentialId, issuerId, documentHash, nonce))
 * 
 * @param commitmentVersion Version of the commitment schema (default 1)
 * @param credentialId 32-byte hex (0x...)
 * @param issuerId 32-byte hex (0x...)
 * @param documentHash 32-byte hex SHA-256 (0x...)
 * @param nonce 32-byte random hex (0x...)
 * @returns 32-byte hex Keccak-256 commitment (0x...)
 */
export function calculateCommitment(
  commitmentVersion: number | bigint,
  credentialId: string,
  issuerId: string,
  documentHash: string,
  nonce: string,
): string {
  const encoded = abiCoder.encode(
    ['uint256', 'bytes32', 'bytes32', 'bytes32', 'bytes32'],
    [BigInt(commitmentVersion), credentialId, issuerId, documentHash, nonce],
  );

  return keccak256(encoded);
}

