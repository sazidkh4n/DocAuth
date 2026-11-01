# Architectural Decision Records (ADRs)

## Index of Decisions

- [ADR-001: Selection of Polygon PoS as the Anchoring Blockchain](#adr-001-selection-of-polygon-pos-as-the-anchoring-blockchain)
- [ADR-002: Adoption of Monorepo Architecture with pnpm Workspaces](#adr-002-adoption-of-monorepo-architecture-with-pnpm-workspaces)
- [ADR-003: Smart Contract Toolchain (Solidity 0.8.28, Hardhat 3, OpenZeppelin 5.x)](#adr-003-smart-contract-toolchain-solidity-0828-hardhat-3-openzeppelin-5x)
- [ADR-004: Privacy-Preserving Cryptographic Commitment Scheme (SHA-256 + Keccak-256 + Nonce)](#adr-004-privacy-preserving-cryptographic-commitment-scheme-sha-256--keccak-256--nonce)
- [ADR-005: Private Object Storage with Envelope Encryption vs Public IPFS](#adr-005-private-object-storage-with-envelope-encryption-vs-public-ipfs)
- [ADR-006: EIP-712 Typed Structured Signatures over Raw ECDSA `eth_sign`](#adr-006-eip-712-typed-structured-signatures-over-raw-ecdsa-eth_sign)
- [ADR-007: Transactional Outbox Pattern with Relayer Gas Sponsorship](#adr-007-transactional-outbox-pattern-with-relayer-gas-sponsorship)
- [ADR-008: Argon2id for User Password Hashing](#adr-008-argon2id-for-user-password-hashing)
- [ADR-009: Redis + BullMQ for Asynchronous Pipeline Processing](#adr-009-redis--bullmq-for-asynchronous-pipeline-processing)
- [ADR-010: Hybrid Organization Onboarding and Governance Model](#adr-010-hybrid-organization-onboarding-and-governance-model)

---

### ADR-001: Selection of Polygon PoS as the Anchoring Blockchain
- **Status:** Accepted
- **Context:** The platform requires an immutable, decentralized ledger to anchor credential commitments, track issuer keys, and record revocations. Ethereum L1 gas fees ($5–$50 per transaction) make high-volume academic and enterprise document issuance economically unviable. Private enterprise blockchains (e.g. Hyperledger Fabric) lack public verifiability and decentralized trust anchors.
- **Decision:** Use **Polygon PoS** (Chain ID: `80002` for Polygon Amoy Testnet, `137` for Polygon Mainnet).
- **Consequences:**
  - Extremely low gas costs (< $0.005 per issuance).
  - Fast block finality (2–5 seconds).
  - Publicly accessible RPCs and block explorers allow any third-party verifier to audit commitments without platform permission.

---

### ADR-002: Adoption of Monorepo Architecture with pnpm Workspaces
- **Status:** Accepted
- **Context:** The system consists of smart contracts, backend API, background workers, shared cryptographic utilities, type declarations, and a web frontend. Managing these in separate repositories leads to drift between Solidity ABI types, TypeScript DTOs, and crypto functions.
- **Decision:** Organize all components in a single monorepo using **pnpm workspaces**.
- **Consequences:**
  - Cryptographic helpers in `packages/crypto` and shared schemas in `packages/shared` are consumed identically across `apps/api`, `apps/worker`, and `apps/web`.
  - Type-safe contract bindings via TypeChain/Ethers v6 are automatically shared from `packages/contracts`.
  - Fast, deduplicated dependency installation with hard links via pnpm.

---

### ADR-003: Smart Contract Toolchain (Solidity 0.8.28, Hardhat 3, OpenZeppelin 5.x)
- **Status:** Accepted
- **Context:** Smart contracts need robust testing, formal verification libraries, and battle-tested access control.
- **Decision:** Standardize on **Solidity `^0.8.28`**, **Hardhat 3**, and **OpenZeppelin Contracts `5.x`**.
- **Consequences:**
  - Native overflow/underflow protection in Solidity 0.8.x.
  - OpenZeppelin 5.x provides gas-optimized custom errors, audited `AccessControl`, `Pausable`, and `ECDSA` cryptographic libraries.
  - Hardhat provides comprehensive TypeScript automated testing and deployment scripting via Hardhat Ignition.

---

### ADR-004: Privacy-Preserving Cryptographic Commitment Scheme
- **Status:** Accepted
- **Context:** Publishing raw document hashes (SHA-256) on a public blockchain risks dictionary attacks: if a document template is known (e.g. standard university degree with student names), an attacker could brute-force candidate names against public hashes.
- **Decision:** Store only a **Keccak-256 commitment** on-chain, calculated over a 256-bit CSPRNG nonce:
  $$\text{Commitment} = \text{keccak256}\left(\text{abi.encode}\left(\text{version}, \text{credentialId}, \text{issuerId}, \text{documentHash}, \text{nonce}\right)\right)$$
- **Consequences:**
  - Guarantees information-theoretic privacy for document recipients.
  - Eliminates rainbow table and dictionary attacks.
  - Enables exact byte verification when the holder presents the document and nonce.

---

### ADR-005: Private Object Storage with Envelope Encryption vs Public IPFS
- **Status:** Accepted
- **Context:** Many blockchain projects mistakenly store user documents on IPFS. IPFS is an unencrypted, globally public peer-to-peer network; once uploaded, personal credentials (PII, salary, addresses) cannot be deleted (violating GDPR / DPDP Right to Erasure).
- **Decision:** Store documents in **private S3-compatible object storage** (MinIO for local development, AWS S3 for production) protected by **AES-256-GCM envelope encryption**.
- **Consequences:**
  - Complete data privacy and access control.
  - Compliance with global data protection regulations (GDPR/DPDP).
  - Short-lived pre-signed URLs restrict access to authorized holders and verifiers.

---

### ADR-006: EIP-712 Typed Structured Signatures over Raw ECDSA `eth_sign`
- **Status:** Accepted
- **Context:** Signing raw hashes via `eth_sign` presents severe security risks (blind signing, phishing attacks, cross-contract and cross-chain replay).
- **Decision:** Implement **EIP-712 typed structured data** for all issuer authorizations (issuance and revocation).
- **Consequences:**
  - Issuers can review human-readable structured fields (issuerId, credentialId, timestamps) in Web3 wallets (MetaMask, Rabby).
  - Domain separation binds signatures to the specific contract address and Polygon chain ID, preventing replay on testnets or fork networks.

---

### ADR-007: Transactional Outbox Pattern with Relayer Gas Sponsorship
- **Status:** Accepted
- **Context:** Organizations should not need native POL cryptocurrency in every HR staff member's wallet to issue documents. Furthermore, directly submitting transactions during an HTTP request causes timeouts, dropped transactions, and data inconsistency if the database commit fails after transaction submission.
- **Decision:** Use the **Transactional Outbox Pattern** with an asynchronous **Relayer Worker** (BullMQ).
- **Consequences:**
  - Document metadata and the pending outbox task are saved atomically in PostgreSQL in one transaction.
  - The backend relayer sponsors gas and manages transaction retry, nonce queueing, and confirmation monitoring.
  - Documents remain in `PENDING_BLOCKCHAIN` until required block confirmations are verified on Polygon.

---

### ADR-008: Argon2id for User Password Hashing
- **Status:** Accepted
- **Context:** Older algorithms like MD5, SHA-1, and SHA-256 without memory hardness are vulnerable to GPU/ASIC brute-force cracking. Even bcrypt is vulnerable to custom FPGA hardware compared to memory-hard functions.
- **Decision:** Adopt **Argon2id** (OWASP recommended password hashing algorithm).
- **Consequences:**
  - Highly resistant to GPU and side-channel attacks due to combined data-dependent and data-independent memory access.
  - Configured with 64 MiB memory cost and 3 iterations.

---

### ADR-009: Redis + BullMQ for Asynchronous Pipeline Processing
- **Status:** Accepted
- **Context:** File scanning, SHA-256 hashing, envelope encryption, blockchain transaction submission, event log synchronization, and notification dispatch are asynchronous, high-latency operations that must not block HTTP request threads.
- **Decision:** Use **BullMQ with Redis 7** to coordinate asynchronous job queues.
- **Consequences:**
  - Robust job lifecycle management with retries, exponential backoff, dead-letter queues, and concurrency control.
  - Clear separation of concerns between HTTP API workers and blockchain execution workers.

---

### ADR-010: Hybrid Organization Onboarding and Governance Model
- **Status:** Accepted
- **Context:** Purely automated decentralized registration would allow malicious actors to register fraudulent organizations and issue misleading credentials.
- **Decision:** Implement a **Hybrid Governance Model**: platform administrators review legal registration evidence off-chain before authorizing on-chain issuer registration and signing keys.
- **Consequences:**
  - Combines legal institutional vetting with decentralized on-chain verification.
  - Clear upgrade path to multi-signature or decentralized oracle consortium approval without changing the underlying contract interface.

