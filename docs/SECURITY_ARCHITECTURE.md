# Security Architecture Specification

## 1. Threat Model and Security Philosophy

The **Decentralized Multi-Document Authentication and Verification Platform** operates under a zero-trust architecture. Documents authenticated on this platform represent high-value credentials (university degrees, professional licenses, employment certifications). Consequently, the platform is designed to defend against malicious document holders, compromised organizational accounts, rogue platform administrators, and network eavesdroppers.

```text
                  TRUST BOUNDARIES AND ATTACK SURFACES
                  
[ Untrusted Public Internet ] 
         |
    (TLS 1.3 / Rate Limiting / WAF)
         v
[ API Boundary: Next.js + NestJS ]  <--- Threat: Brute-force, Session Hijack, Parameter Tampering
         |
    (Tenant Isolation / RBAC)
         v
[ Data Storage Boundary ]           <--- Threat: Database Dump, S3 Bucket Leak, Ransomware
    - DB: AES-256 Envelope Encrypted Nonces & Hashes
    - Storage: AES-256-GCM Encrypted PDFs
         |
    (EIP-712 Signature + Relayer)
         v
[ Blockchain Boundary: Polygon ]    <--- Threat: Replay Attack, Key Compromise, Malleability
```

---

## 2. Cryptographic Security Standards

### 2.1 Authoritative Document Byte Fingerprinting
- **Algorithm:** SHA-256 (NIST FIPS 180-4).
- **Byte Stream Rule:** The authoritative hash is calculated strictly over the raw, uncompressed binary byte stream of the original PDF.
- **Strict Prohibitions:**
  - Never hash extracted PDF text or OCR output (formatting and visual layout can be modified without altering text).
  - Never optimize, re-render, re-save, or compress the PDF after computing the hash.
  - Never trust a client-calculated hash without server-side stream validation.
- **Collision Resistance:** SHA-256 offers a 128-bit security level against collision attacks ($\approx 2^{128}$ operations), rendering intentional collision generation impossible with current and foreseeable computing resources.

### 2.2 CSPRNG Credential IDs and Nonces
- Both `credentialId` and `nonce` are 32 bytes (256 bits) generated using cryptographically secure pseudorandom number generators (`crypto.randomBytes(32)` in Node.js / `getrandom(2)` in Linux).
- **Entropy Guarantee:** 256 bits of true cryptographic entropy eliminates any possibility of sequential guessing, timestamp correlation, or rainbow-table pre-computation.

### 2.3 Keccak-256 Commitment Scheme
The privacy-preserving commitment permanently binds the credential ID, the issuing organization, the document hash, and the secret nonce:

$$\text{Commitment} = \text{Keccak-256}\left(\text{abi.encode}\left(\text{version}, \text{credentialId}, \text{issuerId}, \text{documentHash}, \text{nonce}\right)\right)$$

- **Solidity and TypeScript Alignment:** Both the NestJS crypto library and the `DocumentRegistry.sol` smart contract use standard Solidity ABI encoding rules (`abi.encode`, preserving 32-byte word alignment) to guarantee identical outputs.
- **Hiding Property:** Given $\text{Commitment}$, an attacker cannot discover $\text{documentHash}$ due to the 256-bit random $\text{Nonce}$.
- **Binding Property:** Given $\text{Commitment}$, an attacker cannot find any other pair $(\text{documentHash}', \text{nonce}')$ that produces the same commitment.

### 2.4 Privacy-Preserving HMAC Lookup Index
To allow verification of a document uploaded without an explicit credential ID while preventing attackers from discovering registered hashes via database dumps:
- The database stores a `hash_lookup` calculated via:
  $$\text{hash\_lookup} = \text{HMAC-SHA256}(\text{documentHash}, K_{\text{hmac}})$$
- The secret key $K_{\text{hmac}}$ is managed via a dedicated secret manager / environment variable and is **never** stored inside the PostgreSQL database.
- A database leak alone does not permit an attacker to identify which documents are stored in the registry.

### 2.5 Envelope Encryption (AES-256-GCM)
Documents at rest in MinIO/S3 are protected via envelope encryption:
1. For every document, a unique 256-bit Data Encryption Key (DEK) is generated.
2. The document is encrypted using AES-256-GCM with an authenticated 96-bit Initialization Vector (IV) and a 128-bit authentication tag.
3. The DEK is encrypted (wrapped) using the master Key Encryption Key (KEK) managed by KMS or local secure key store.
4. GCM mode guarantees both confidentiality and ciphertext integrity.

---

## 3. Identity and Access Security

### 3.1 Argon2id Password Hashing
User passwords are stored using **Argon2id** (the winner of the Password Hashing Competition) configured to OWASP recommendations:
- **Memory Cost ($m$):** 65536 KiB (64 MiB)
- **Time Cost ($t$):** 3 iterations
- **Parallelism ($p$):** 4 threads
- **Salt:** 16 cryptographically random bytes generated per user

### 3.2 Session Lifecycle & Refresh Token Rotation
- **Access Tokens:** Short-lived JWTs (15 minutes lifespan) containing user ID, session ID, and authorized organization roles.
- **Refresh Tokens:** High-entropy random tokens stored as SHA-256 hashes in `auth_sessions`.
- **Automatic Reuse Detection:** When a refresh token is presented, a new refresh token and access token are issued, and the previous token is invalidated. If a previously consumed refresh token is presented again (indicating token theft by an attacker), all sessions in that token family are revoked immediately.

### 3.3 Strict Tenant Isolation Interceptor
To eliminate Insecure Direct Object Reference (IDOR) vulnerabilities:
- Every API endpoint operating on organizational resources requires an active organization context (`X-Organization-Id` header).
- NestJS `OrgMembershipGuard` intercepts the request, verifies that the authenticated user has an `ACTIVE` membership with the specified organization, and injects the validated tenant scope into the database query.
- Users can never access or modify another organization's documents, keys, or verification cases.

### 3.4 Multi-Factor Authentication (MFA)
- Mandatory for platform Super Administrators and Organization Administrators.
- Implemented using Time-based One-Time Password (TOTP, RFC 6238) with SHA-1/SHA-256, 30-second time steps, and 6-digit codes.
- TOTP secrets are encrypted at rest using AES-256-GCM.

---

## 4. File Upload & Processing Security

Following the OWASP File Upload Security Cheat Sheet:

```text
Incoming Upload 
      |
      v
[ 1. Byte Size Check ]        --> Max 25 MB per PDF
      |
      v
[ 2. Magic Byte Audit ]       --> Requires %PDF- header (0x25 0x50 0x44 0x46 0x2D)
      |
      v
[ 3. Quarantine Isolation ]   --> Written to isolated quarantine S3 bucket with random UUID key
      |
      v
[ 4. PDF Structure Scan ]     --> Rejects executable payloads, JavaScript triggers, embedded Launch actions
      |
      v
[ 5. Malware Scanner Hook ]   --> Stream scanned via ClamAV / VirusTotal adapter
      |
      v
[ 6. Stream Hashing ]         --> Computes SHA-256 over exact unmodified file stream
      |
      v
[ 7. Envelope Encryption ]    --> AES-256-GCM encryption with unique DEK
      |
      v
[ 8. Permanent Storage ]      --> Moved to private permanent bucket; quarantine deleted
```

- **Path Traversal Protection:** Original client filenames are discarded. Object keys are strictly generated as `UUIDv4.pdf`.
- **Pre-Signed URLs:** Downloads are authorized solely through short-lived (5-minute maximum) pre-signed URLs generated after verifying caller authorization.

---

## 5. Blockchain and Smart Contract Security

### 5.1 EIP-712 Structured Data & Anti-Replay
- All document issuance transactions require an off-chain digital signature compliant with EIP-712.
- The EIP-712 domain separator includes:
  - `name`: `"DecentralizedDocumentPlatform"`
  - `version`: `"1"`
  - `chainId`: Dynamically evaluated to prevent cross-network replay.
  - `verifyingContract`: DocumentRegistry address to prevent cross-contract replay.
- `credentialId` is enforced unique on-chain; any duplicate issuance reverts immediately.

### 5.2 Signature Malleability Mitigation
- Signatures are verified using OpenZeppelin's `ECDSA.recover`.
- Rejects signatures where the $s$-value exceeds $\frac{secp256k1n}{2}$ to prevent malleability attacks.

### 5.3 Relayer Nonce & Gas Management
- The backend relayer submits transactions on behalf of organizations (sponsoring gas).
- Relayer private keys are stored in a secure secret manager and never exposed to client applications.
- Nonces are managed using a mutex-locked in-memory tracker with on-chain synchronization to prevent stalled transactions during high throughput.

### 5.4 Key Compromise & Historical Audit Policy
- Organizations can mark an `IssuerKey` as compromised with a specific timestamp.
- Documents issued *after* the compromise timestamp are rejected during verification.
- Documents issued *prior* to the compromise timestamp remain valid if supported by verifiable prior audit logs, protecting organizations from complete credential invalidation.

---

## 6. Privacy & Data Minimization (GDPR / DPDP Compliance)

1. **Zero Personally Identifiable Information (PII) On-Chain:**
   - The blockchain ledger records only 32-byte cryptographic hashes and commitments.
   - It is mathematically impossible to reconstruct a recipient's name, grade, salary, or employment tenure from on-chain data.
2. **Right to Erasure / Revocation Distinction:**
   - Revoking a document marks its status as `REVOKED` on Polygon.
   - If a holder exercises the Right to Erasure, the encrypted PDF file and database metadata can be permanently purged from private storage while the on-chain commitment remains an anonymous cryptographic artifact.
3. **Consent-Based Sharing:**
   - Third-party verifiers can only view full document metadata if the holder has generated an active, unexpired sharing grant (`document_shares`).
   - Public unauthenticated verifiers receive strictly boolean verification verdicts without holder PII.

