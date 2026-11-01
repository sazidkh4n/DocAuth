# Comprehensive Testing Strategy

## 1. Testing Philosophy & Standards

The platform enforces a strict **Evidence Before Assertions** testing philosophy:
1. No task is marked completed simply because code was written; it must be backed by executed and passing automated tests.
2. No mock verifications in production test suites: verification must test real cryptographic calculations and real smart contract invocations.
3. Every cryptographic invariant and failure branch must be explicitly verified with negative test vectors.

---

## 2. Test Pyramid & Tooling

```text
               /\
              /  \     End-to-End Scenarios (A - I)
             / E2E \    [Supertest, Ethers.js, Real Contracts]
            /-------\
           /         \   Integration Tests
          / Integrat. \   [NestJS Testbed, PostgreSQL, MinIO, BullMQ]
         /-------------\
        /  Unit Tests   \  Smart Contract Tests
       /   & Crypto      \ [Hardhat, Chai, OZ Test Helpers]
      /-------------------\
```

| Layer | Tools | Scope | Target Coverage |
|---|---|---|---|
| **Cryptographic Utilities** | Vitest / Jest | Byte SHA-256, Keccak-256 commitments, nonces, envelope encryption, HMAC lookups | 100% |
| **Smart Contracts** | Hardhat, Chai, Ethers v6 | `IssuerRegistry.sol`, `DocumentRegistry.sol`, EIP-712 recovery, AccessControl, Pausable | 100% |
| **Backend Integration** | Jest, Supertest, Prisma | Auth sessions, Org onboarding, RBAC guards, Outbox queues, File storage | > 90% |
| **End-to-End Workflows** | Automated E2E Runner | Scenarios Test A through Test I | 100% Scenarios Passing |

---

## 3. Smart Contract Test Matrix

```markdown
### IssuerRegistry.sol
- [ ] should initialize with default admin and pause roles correctly
- [ ] should register an issuer with initial signer when called by ISSUER_MANAGER_ROLE
- [ ] should revert if registering existing issuer ID
- [ ] should revert if caller lacks ISSUER_MANAGER_ROLE
- [ ] should update issuer status (ACTIVE, SUSPENDED, REVOKED) and emit event
- [ ] should rotate signing key to version v+1 and emit SigningKeyAdded
- [ ] should revoke signing key with or without compromise timestamp
- [ ] should correctly return isSigningKeyValid for active key at valid timestamp
- [ ] should reject isSigningKeyValid for timestamp after recorded compromise time
- [ ] should reject operations when paused

### DocumentRegistry.sol
- [ ] should issue a credential with valid EIP-712 signature from authorized issuer key
- [ ] should revert issuance if issuer is SUSPENDED or REVOKED in IssuerRegistry
- [ ] should revert issuance if signer address does not match keyVersion in IssuerRegistry
- [ ] should revert issuance if signature is malformed or forged
- [ ] should revert issuance if credentialId already exists (anti-replay)
- [ ] should revert issuance if issuedAt > block.timestamp (future dated)
- [ ] should revert issuance if expiresAt > 0 and expiresAt <= issuedAt
- [ ] should revoke credential when called with valid issuer revocation signature
- [ ] should revert revocation if signature is from unauthorized signer
- [ ] should revert revocation if credential is already REVOKED
- [ ] should allow EMERGENCY_GUARDIAN_ROLE to revoke without issuer signature
- [ ] should pause and unpause contract, blocking new issuances but allowing read queries
```

---

## 4. Cryptographic & Document Integrity Test Vectors

| Scenario | Input | Expected Outcome | Rationale |
|---|---|---|---|
| **Original Registered PDF** | Exact byte-for-byte original PDF | `AUTHENTIC_ACTIVE` | SHA-256 matches; commitment matches on-chain; issuer is active. |
| **Change 1 Character in PDF** | Altered single character (e.g. "Junior" -> "Senior") | `DOCUMENT_MODIFIED` | SHA-256 diverges; recalculated commitment does not match on-chain record. |
| **Change Employment Dates** | Modified start/end year in PDF stream | `DOCUMENT_MODIFIED` | Byte divergence alters SHA-256. |
| **Modify Metadata Only** | Edited PDF Author / Creator metadata | `DOCUMENT_MODIFIED` | Byte integrity applies to exact file stream, not just visual text. |
| **Re-save via PDF Editor** | Re-saving with compression / linearization | `DOCUMENT_MODIFIED` | Stream bytes change even if visual appearance is identical. |
| **Unrelated PDF Upload** | PDF never registered on platform | `NOT_REGISTERED` | Document hash not found in HMAC index; no credential ID matched. |
| **Valid PDF from Suspended Org** | Genuine PDF issued by currently suspended org | `ISSUER_SUSPENDED` | Integrity passes, but issuer status check flags organizational suspension. |
| **Revoked Credential** | PDF of legitimately issued but revoked credential | `DOCUMENT_REVOKED` | On-chain status check detects `REVOKED`. |
| **Expired Credential** | PDF of expired credential past `expiresAt` | `DOCUMENT_EXPIRED` | System checks `expiresAt < now()` and reports expiration. |

---

## 5. Mandatory End-to-End Scenario Specifications (Test A – Test I)

### Test A: University Degree (Happy Path)
- **Setup:** University A is verified and ACTIVE on Polygon. Key v1 registered.
- **Action:** University issues Bachelor of Science degree PDF to Student Alice. Alice presents PDF to Employer B. Employer B verifies via public verifier.
- **Verification:** All 9 checks pass. Returns `AUTHENTIC_ACTIVE` with transaction hash, block height, and University A legal name.

### Test B: Modified Experience Letter (Tamper Detection)
- **Setup:** Company A issues Experience Letter to Rahul ("Junior Developer, 2024–2026").
- **Action:** Rahul modifies PDF bytes to read "Senior Developer, 2023–2026" and presents to Company B.
- **Verification:** Verification engine calculates SHA-256 on modified bytes, recalculates commitment, compares with on-chain record. Commitment mismatch detected. Returns `DOCUMENT_MODIFIED`. Original on-chain record remains unchanged.

### Test C: Company Suspension
- **Setup:** Company A issues valid credential at $T_1$. At $T_2$, Company A is suspended by platform administration due to compliance investigation.
- **Action:** Verifier submits document at $T_3$.
- **Verification:** Verification engine distinguishes historical validity from current issuer status. Returns document integrity PASSED with status warning `ISSUER_SUSPENDED`.

### Test D: Revoked Document
- **Setup:** Company A issues certificate, then discovers holder submitted fraudulent employment claims.
- **Action:** Company A calls revocation endpoint with authorized EIP-712 revocation signature. Relayer submits transaction. Mined on Polygon.
- **Verification:** Verifier checks document. Verification engine detects on-chain status `REVOKED`. Returns `DOCUMENT_REVOKED` with revocation reason and timestamp.

### Test E: Corrected Document
- **Setup:** Degree certificate issued with typo in candidate name.
- **Action:** Issuer revokes original document ($C_1$), issues corrected document ($C_2$) with `supersedes_document_id = C_1`.
- **Verification:** Verifier of $C_1$ sees `DOCUMENT_REVOKED (Superseded by C2)`. Verifier of $C_2$ sees `AUTHENTIC_ACTIVE` with link to historical lineage.

### Test F: Signing-Key Compromise
- **Setup:** Company A's server holding Key v1 private key is compromised on 2026-10-25. Company A reports compromise with timestamp `compromisedAt = 2026-10-25T00:00:00Z` and rotates to Key v2.
- **Action:**
  1. Document issued on 2026-10-20 with Key v1 is verified.
  2. Document purportedly issued on 2026-10-26 with Key v1 is verified.
- **Verification:** Case 1 passes (issued prior to compromise). Case 2 fails with `ISSUER_KEY_COMPROMISED`.

### Test G: Unauthorized Document Access (Private Storage Denial)
- **Setup:** Company A issues private document stored in encrypted MinIO bucket.
- **Action:** User from Company B attempts to call `GET /documents/:id` or craft a pre-signed URL to Company A's file object.
- **Verification:** Request is intercepted by `OrgMembershipGuard`. Access is denied with `403 Forbidden`. No file stream or metadata is leaked.

### Test H: Blockchain Outage / RPC Failure
- **Setup:** Polygon RPC endpoint is deliberately blocked or simulated to fail with HTTP 500 / timeout.
- **Action:** Verifier uploads document for verification.
- **Verification:** System detects RPC failure. It **does not** assume authenticity or emit a false green checkmark. Returns `503 Service Unavailable` with verdict `VERIFICATION_UNAVAILABLE`.

### Test I: Blockchain Transaction Failure Handling
- **Setup:** Relayer submits issuance transaction with insufficient gas or invalid nonce causing transaction revert on-chain.
- **Action:** Worker monitors transaction receipt.
- **Verification:** Worker detects revert. Document status in PostgreSQL remains `PENDING_BLOCKCHAIN` or transitions to `BLOCKCHAIN_FAILED`. Document is **never** prematurely marked `ACTIVE`.

---

## 6. Security & Vulnerability Penetration Tests

1. **Malicious File Upload:**
   - Attempt uploading `.exe` renamed to `.pdf`: Blocked by magic byte inspector (`0x25 0x50 0x44 0x46 0x2D`).
   - Attempt uploading PDF with embedded `/JavaScript` or `/Launch` action: Sanitized or rejected by parser.
   - Attempt uploading 100 MB file: Terminated at 25 MB stream limit.
2. **Replay & Malleability:**
   - Submit existing `credentialId` with valid signature: Smart contract reverts with `CredentialAlreadyExists`.
   - Submit inverted signature $s > \frac{n}{2}$: OpenZeppelin ECDSA reverts with `ECDSAInvalidSignatureS`.
3. **Tenant Escalation:**
   - User authenticated to Org 1 passes Org 2 ID in `X-Organization-Id` or route params: Guard returns `403 Forbidden`.

