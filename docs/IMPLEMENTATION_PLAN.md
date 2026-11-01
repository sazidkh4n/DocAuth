# IMPLEMENTATION PLAN: Decentralized Multi-Document Authentication and Verification Platform

**Platform:** Polygon PoS (Amoy Testnet / Mainnet)  
**Backend:** Node.js + NestJS + TypeScript + Prisma + PostgreSQL + Redis/BullMQ  
**Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS / Modern UI  
**Smart Contracts:** Solidity 0.8.28 + Hardhat 3 / OpenZeppelin 5.x  
**Storage & Security:** MinIO / S3-compatible encrypted object storage, Envelope Encryption, SHA-256, Keccak-256 Commitments, EIP-712 ECDSA Signatures  
**Document Format:** PDF (extensible to other binary formats)  
**Last Updated:** 2026-10-31  

---

## Overall Roadmap and Phases Summary

| Phase | Title | Focus Area | Status |
|---|---|---|---|
| Phase 0 | Workspace Inspection & Project Planning | Environment discovery, architecture specifications, planning docs | Completed |
| Phase 1 | Project Foundation & Monorepo Setup | pnpm workspaces, NestJS API, Next.js Web, Hardhat, Packages, Docker/Infra | Completed |
| Phase 2 | Authentication & Authorization Engine | Users, Sessions, Argon2id, Refresh Tokens, RBAC, Multi-Org Memberships, MFA | Completed |
| Phase 3 | Organization Onboarding & Verification | Applications, Evidence, Admin Review, Issuer ID, Key Provisioning, Status Lifecycle | Completed |
| Phase 4 | Smart Contract Development & Testing | `IssuerRegistry.sol`, `DocumentRegistry.sol`, EIP-712 Verification, Hardhat Tests | Completed |
| Phase 5 | Storage & Cryptographic Infrastructure | MinIO, Envelope Encryption, PDF Validation, SHA-256, Nonce & Commitment Engine, HMAC Index | Completed |
| Phase 6 | Document Issuance Module | Org Issuance UI/API, Transactional Outbox, Blockchain Relayer, BullMQ, QR Generation | Completed |
| Phase 7 | Document Verification Engine | Multi-step Verification Engine, File Upload, QR/Credential Lookup, Blockchain Verification, Tamper Detection | Completed |
| Phase 8 | Holder Credential Wallet & Delegation | Holder Portal, My Documents, Claiming Unregistered Issuances, Consent-based Sharing, History | Completed |
| Phase 9 | Platform Administration & Observability | Super Admin Dashboard, Issuer Controls, Audit Trails, Reorg / Event Indexer, Health Monitoring | Completed |
| Phase 10 | End-to-End Hardening, Security & Deployment | Security Scenarios A-I, Chaos Testing, Testnet Deployment, Production Guides | Completed |

---

## Phase 0: Workspace Inspection & Project Planning

### Objective
Inspect the workspace environment, discover available local runtimes (Node, pnpm, git, Docker/WSL, databases), establish foundational architecture specifications, determine external dependencies, and define execution rules.

### Technical Requirements
- Node.js >= 20.x (Detected: Node v24.22.1)
- pnpm >= 9.x (Detected: pnpm 11.22.0)
- Git installed (Detected: Git 2.52.0)
- WSL2 / Docker verification for local PostgreSQL, Redis, MinIO
- 11 comprehensive system documentation files in `docs/`

### Tasks and Subtasks
- [x] **Task 0.1: Workspace & Toolchain Audit**
  - [x] Inspect directory structure and check for pre-existing code.
  - [x] Check Node.js, pnpm, npm, git, docker, psql, and wsl toolchain versions.
  - [x] Record runtime constraints and local vs cloud mock fallback strategies.
- [x] **Task 0.2: Author Foundational Technical Specifications**
  - [x] Create `docs/IMPLEMENTATION_PLAN.md` (this file).
  - [x] Create `docs/ARCHITECTURE.md` (System flows, components, trust dimensions).
  - [x] Create `docs/DATABASE_SCHEMA.md` (Prisma schema, entity relations, indexing).
  - [x] Create `docs/SMART_CONTRACT_SPECIFICATION.md` (Solidity interfaces, ABI, events, error codes).
  - [x] Create `docs/API_SPECIFICATION.md` (REST endpoints, DTOs, response schemas).
  - [x] Create `docs/SECURITY_ARCHITECTURE.md` (EIP-712, envelope encryption, tamper detection, RBAC).
  - [x] Create `docs/VERIFICATION_WORKFLOW.md` (9-step cryptographic verification engine pipeline).
  - [x] Create `docs/DEPLOYMENT_GUIDE.md` (Docker Compose, Amoy Testnet, environment variables).
  - [x] Create `docs/TESTING_STRATEGY.md` (Unit, integration, contract, and e2e scenarios A-I).
  - [x] Create `docs/DECISIONS.md` (Architectural Decision Records).
  - [x] Create `docs/PROJECT_STATUS.md` (Progress tracker and blocker registry).
- [x] **Task 0.3: Dependency & Credential Identification**
  - [x] Separate immediate local dependencies from later cloud/testnet credentials.
  - [x] Create template `.env.example` defining all configuration variables.

### Deliverables
- Complete set of 11 system design documents in `docs/`.
- Verified execution roadmap and dependency map.

### Acceptance Criteria
- All 11 markdown files exist and fully detail the design, architecture, schemas, and verification pipelines without placeholder text.

---

## Phase 1: Project Foundation & Monorepo Setup

### Objective
Scaffold the clean pnpm monorepo with strict TypeScript configuration, workspace package linking, containerized local services (PostgreSQL, Redis, MinIO), and unified build scripts.

### Technical Requirements
- pnpm workspaces configuration (`pnpm-workspace.yaml`)
- Root `package.json` with scripts for dev, build, test, lint, and db migrations
- TypeScript 5.x with composite project references and strict type checking
- Docker Compose definition for PostgreSQL 16, Redis 7, MinIO, and local mailpit/mock services

### Tasks and Subtasks
- [x] **Task 1.1: Monorepo Root Scaffolding**
  - [x] Initialize `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `.editorconfig`.
  - [x] Configure shared `tsconfig.base.json` with strict mode enabled.
  - [x] Configure pnpm build and dependency rules.
- [x] **Task 1.2: Shared Packages Setup**
  - [x] Create `packages/shared`: Common types, enums, DTO validation schemas, constants.
  - [x] Create `packages/crypto`: SHA-256 file hasher, Keccak-256 commitment calculator, EIP-712 typed structured data builders, CSPRNG nonce generator, HMAC lookup indexer, AES-256-GCM envelope encryption utilities.
  - [x] Create `packages/contracts`: Hardhat 3 TypeScript project with OpenZeppelin 5.x.
  - [x] Create `packages/blockchain-client`: Ethers.js v6 abstraction layer, contract ABI bindings.
- [x] **Task 1.3: Applications Scaffolding**
  - [x] Create `apps/api`: NestJS application with ConfigModule, PrismaModule, LoggerModule, and Swagger.
  - [x] Create `apps/worker`: NestJS background worker using BullMQ for asynchronous jobs.
  - [x] Create `apps/web`: Next.js 14+ App Router frontend with TypeScript, Tailwind CSS, Lucide icons.
- [x] **Task 1.4: Local Infrastructure Configuration**
  - [x] Create `docker-compose.yml` with services: `postgres`, `redis`, `minio`, `createbuckets` helper.
  - [x] Create `.env.example` and local `.env` setup instructions.
  - [x] Verify database connectivity and Prisma client generation.

### Files to Create
- `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, `docker-compose.yml`, `.env.example`
- `packages/shared/src/*`, `packages/crypto/src/*`, `packages/contracts/*`, `packages/blockchain-client/src/*`
- `apps/api/src/*`, `apps/worker/src/*`, `apps/web/src/*`

### Acceptance Criteria
- `pnpm install` succeeds across all workspaces.
- `pnpm build` compiles all shared packages and apps without TypeScript errors.
- Docker containers for PostgreSQL, Redis, and MinIO spin up and health checks pass.

---

## Phase 2: Authentication & Authorization Engine

### Objective
Implement secure multi-tenant identity, authentication, session lifecycle, password security with Argon2id, refresh token rotation, role-based access control (RBAC), and multi-organization memberships.

### Technical Requirements
- Argon2id password hashing with custom salt and memory cost
- JWT access tokens (short-lived, 15m) + secure rotating refresh tokens in `auth_sessions`
- Prisma models: `User`, `AuthSession`, `OrganizationMembership`, `AuditLog`
- NestJS Guards: `JwtAuthGuard`, `RolesGuard`, `OrgMembershipGuard`

### Tasks and Subtasks
- [x] **Task 2.1: Database Schema & Migrations**
  - [x] Implement Prisma schema for users, auth sessions, and organization memberships.
  - [x] Generate Prisma client and define entity relations.
- [x] **Task 2.2: Auth Module Implementation**
  - [x] Implement `POST /auth/register` (Email, password, name, role preference).
  - [x] Implement `POST /auth/login` with brute-force rate limiting and Argon2id verification.
  - [x] Implement `POST /auth/refresh` with automatic token rotation and reuse detection.
  - [x] Implement `POST /auth/logout` (session revocation).
  - [x] Implement `GET /auth/me` with user profile and active organization memberships.
  - [x] Implement TOTP-based Multi-Factor Authentication (`/auth/mfa/enable`, `/auth/mfa/verify`).
- [x] **Task 2.3: Access Control & Security Guards**
  - [x] Create RBAC decorators (`@Roles()`, `@OrgRole()`) and execution guards.
  - [x] Create organization tenant isolation interceptor to prevent cross-tenant ID tampering.
- [x] **Task 2.4: Automated Auth Tests**
  - [x] Unit tests for Argon2id hashing, token signing, session rotation.
  - [x] Integration tests for registration, login, expired tokens, stolen refresh token invalidation (8/8 tests pass).

### Deliverables
- Complete NestJS `AuthModule`, `UsersModule`, `MembershipsModule`.
- Passing test suite for authentication and RBAC.

### Acceptance Criteria
- 100% test pass on registration, authentication, token rotation, invalidation, and permission checks.

---

## Phase 3: Organization Onboarding & Verification

### Objective
Implement the hybrid organization verification system allowing institutions to submit formal onboarding applications with registration evidence, administrators to review and approve/reject, and automated provisioning of opaque Issuer IDs and key registries.

### Technical Requirements
- Application lifecycle states: `PENDING`, `UNDER_REVIEW`, `APPROVED`, `ACTIVE`, `REJECTED`, `SUSPENDED`, `REVOKED`
- Secure evidence file storage in private MinIO bucket
- Opaque 32-byte `issuer_id` derivation
- Prisma models: `Organization`, `OrganizationVerificationCase`, `OrganizationEvidenceFile`, `IssuerKey`

### Tasks and Subtasks
- [x] **Task 3.1: Organization Profile & Application Submission**
  - [x] Implement `POST /organizations/apply` with legal name, registration number, category, website, authorized rep details.
  - [x] Implement multi-part evidence file upload to quarantine storage.
  - [x] Implement `GET /organizations/me` and `PATCH /organizations/me`.
- [x] **Task 3.2: Administrator Review & Governance Workflow**
  - [x] Implement `GET /admin/organizations` with filtering by review status.
  - [x] Implement `GET /admin/organizations/:id` for case evaluation.
  - [x] Implement `POST /admin/organizations/:id/approve` with opaque `issuer_id` generation.
  - [x] Implement `POST /admin/organizations/:id/reject` with recorded rejection notes.
  - [x] Implement `POST /admin/organizations/:id/suspend` and `/reactivate`.
- [x] **Task 3.3: Issuer Signing Key Management**
  - [x] Implement `POST /organizations/me/signing-keys` to register initial public wallet address (Key v1).
  - [x] Implement `POST /organizations/me/signing-keys/rotate` for key versioning (v2, v3).
  - [x] Implement `POST /organizations/me/signing-keys/:id/revoke` with compromise timestamp tracking.
- [x] **Task 3.4: Automated Tests**
  - [x] Test application submission, admin review state transitions, issuer ID uniqueness, key rotation logic (5/5 tests pass).

### Deliverables
- NestJS `OrganizationsModule`, `OrganizationVerificationModule`, `IssuerKeysModule`.
- Admin verification APIs and organization membership bindings.

### Acceptance Criteria
- An organization can apply, upload evidence, be reviewed by admin, receive an opaque `issuer_id`, and register authorized signing keys.

---

## Phase 4: Smart Contract Development & Testing

### Objective
Develop, rigorously test, and deploy the core Solidity smart contracts on Polygon: `IssuerRegistry.sol` and `DocumentRegistry.sol` using Hardhat, OpenZeppelin 5.x, and EIP-712 typed structured signatures.

### Technical Requirements
- Solidity `^0.8.28`
- OpenZeppelin Contracts 5.x (`AccessControlUpgradeable` / `AccessControl`, `Pausable`, `ECDSA`, `EIP712`)
- Custom Solidity errors for gas efficiency
- Comprehensive test coverage for all authorization, replay, and tamper scenarios

### Tasks and Subtasks
- [x] **Task 4.1: Implement `IssuerRegistry.sol`**
  - [x] Issuer lifecycle: `registerIssuer`, `setIssuerStatus` (`ACTIVE`, `SUSPENDED`, `REVOKED`).
  - [x] Key management: `addSigningKey`, `rotateSigningKey`, `revokeSigningKey`.
  - [x] Validation views: `isIssuerActive(bytes32 issuerId)`, `isSigningKeyValid(bytes32 issuerId, uint32 keyVersion, address signer, uint64 atTimestamp)`.
- [x] **Task 4.2: Implement `DocumentRegistry.sol`**
  - [x] Storage: Mapping `credentialId => CredentialRecord(bytes32 issuerId, bytes32 commitment, uint64 issuedAt, uint64 expiresAt, uint32 keyVersion, DocumentStatus status)`.
  - [x] EIP-712 typed structured data verification for credential issuance:
    - Struct: `IssueCredential(bytes32 issuerId, bytes32 credentialId, bytes32 commitment, uint64 issuedAt, uint64 expiresAt, uint32 keyVersion, uint32 schemaVersion)`.
  - [x] Issuance function: `issueCredential(...)` verifying issuer status, key authorization at issuance time, credential uniqueness, and event emission.
  - [x] Revocation function: `revokeCredential(bytes32 credentialId, bytes memory issuerSignature, string reason)` with authorized key signature.
  - [x] Query functions: `getCredential`, `getCredentialCommitment`, `isCredentialActive`.
  - [x] Emergency controls: `pause()`, `unpause()` by `PAUSER_ROLE`.
- [x] **Task 4.3: Hardhat Automated Contract Test Suite**
  - [x] Test unapproved organization issuance rejection.
  - [x] Test active organization valid issuance and event emission.
  - [x] Test unauthorized signer rejection.
  - [x] Test invalid/mismatched signature recovery.
  - [x] Test duplicate credential ID rejection (replay protection).
  - [x] Test revoked issuer issuance rejection.
  - [x] Test signing key rotation and revocation validity checks.
  - [x] Test document revocation by authorized signer vs unauthorized attacker.
  - [x] Test emergency pause blocks issuance but allows verification queries.
- [x] **Task 4.4: Deployment Scripts & Hardhat Ignition**
  - [x] Config for local Hardhat node and Polygon Amoy testnet.
  - [x] Deployment and verification scripts.

### Deliverables
- `packages/contracts/contracts/IssuerRegistry.sol`
- `packages/contracts/contracts/DocumentRegistry.sol`
- Full test suite with 100% branch and function coverage.

### Acceptance Criteria
- All Hardhat tests pass. Contract bytecode verifies gas optimization and security invariants.

---

## Phase 5: Storage & Cryptographic Infrastructure

### Objective
Build the private S3/MinIO encrypted document storage pipeline and the authoritative cryptographic package implementing SHA-256 byte hashing, envelope encryption (AES-256-GCM), CSPRNG nonces, Keccak-256 commitments, and HMAC lookup indexes.

### Technical Requirements
- MinIO client with pre-signed upload/download URLs
- Stream-based SHA-256 byte hashing on original, unmodified PDF bytes
- Envelope encryption: unique AES-256-GCM Data Encryption Key (DEK) per document, wrapped by Key Encryption Key (KEK)
- Commitment calculation: `keccak256(abi.encode(commitmentVersion, credentialId, issuerId, documentHash, nonce))`
- HMAC-SHA256 protected lookup index for privacy-preserving document lookup

### Tasks and Subtasks
- [x] **Task 5.1: Cryptographic Package Implementation (`packages/crypto`)**
  - [x] Implement `calculateSha256(buffer | stream): Promise<string>` and sync.
  - [x] Implement `generateCredentialId(): string` (32 cryptographically secure random bytes).
  - [x] Implement `generateNonce(): string` (32 cryptographically secure random bytes).
  - [x] Implement `calculateCommitment(version, credentialId, issuerId, documentHash, nonce): string` using standard ABI encoding matching Solidity.
  - [x] Implement `generateHmacLookup(documentHash, secretKey): string`.
  - [x] Implement `encryptFileEnvelope(buffer, kek)` and `decryptFileEnvelope(encryptedPayload, kek)`.
  - [x] Cross-verification test: Validate that TypeScript commitment calculation produces byte-identical hash to Solidity `keccak256(abi.encode(...))`.
- [x] **Task 5.2: Storage Service (`apps/api/src/file-storage`)**
  - [x] Configure MinIO S3 client with private bucket enforcement and in-memory test fallback.
  - [x] Implement secure upload pipeline: Quarantine -> File signature/MIME audit -> PDF byte size check -> Stream SHA-256 -> AES-256-GCM encryption -> Permanent storage.
  - [x] Implement short-lived pre-signed download URL generation with authorization guard.
- [x] **Task 5.3: Automated Storage & Crypto Tests**
  - [x] Test PDF byte hashing stability across streaming vs buffer.
  - [x] Test that single-byte file modification changes SHA-256 and commitment.
  - [x] Test envelope encryption and decryption round-trip fidelity.

### Deliverables
- Reusable `packages/crypto` library with cross-environment test suite (6/6 tests pass).
- MinIO integration in NestJS `FileStorageModule`.

### Acceptance Criteria
- Exact original PDF bytes are preserved through encryption and decryption.
- Commitment output in TypeScript matches Solidity contract test vectors identically.

---

## Phase 6: Document Issuance Module

### Objective
Implement the complete end-to-end document issuance pipeline: PDF upload, metadata extraction, cryptographic processing, EIP-712 issuer signing, transactional outbox persistence, BullMQ asynchronous blockchain submission, transaction confirmation monitoring, and QR code generation.

### Technical Requirements
- NestJS `DocumentsModule` and BullMQ `BlockchainWorker`
- Transactional outbox pattern for reliable blockchain transaction dispatch
- EIP-712 signing payload generator and backend verification
- QR code generator encoding verification URL and opaque credential ID

### Tasks and Subtasks
- [x] **Task 6.1: Document Issuance APIs**
  - [x] Implement `POST /documents/upload-session` (initiates issuance session, checks issuer active status).
  - [x] Implement `POST /documents/:id/finalize-upload` (validates PDF, computes SHA-256, generates credential ID & nonce, returns EIP-712 message for signing).
  - [x] Implement `POST /documents/:id/issue` (accepts issuer signature, validates EIP-712 signer against authorized key, enqueues blockchain issuance job).
  - [x] Implement `GET /documents` and `GET /documents/:id` with organization ownership checks.
- [x] **Task 6.2: Asynchronous Blockchain Relayer Worker**
  - [x] Implement BullMQ job queue for blockchain submissions.
  - [x] Relayer transaction submitter with automatic nonce management and gas pricing.
  - [x] Confirmation tracker: polls for required confirmations on Polygon Amoy.
  - [x] State synchronizer: updates document status to `ACTIVE` upon confirmation and logs transaction hash.
- [x] **Task 6.3: QR Code & Verification Reference Generation**
  - [x] Generate high-resolution SVG/PNG QR code containing `https://platform/verify/{credentialId}`.
  - [x] Attach secure download references for holder.
- [x] **Task 6.4: Issuance Automated Tests**
  - [x] Test end-to-end issuance flow from upload to transaction submission and activation.
  - [x] Test failed transaction retry and error logging.

### Deliverables
- NestJS `DocumentsModule` and Worker `BlockchainProcessor`.
- Operational issuance workflow with QR code generation.

### Acceptance Criteria
- PDF document is uploaded, hashed, signed via EIP-712, submitted to Polygon, mined, confirmed, and activated with QR code.

---

## Phase 7: Document Verification Engine

### Objective
Build the authoritative multi-step verification engine supporting both QR/credential ID direct lookup and protected HMAC document-hash indexing, performing independent cryptographic recalculation, issuer status validation, digital signature verification, and blockchain confirmation checks.

### Technical Requirements
- 9-step verification engine returning granular verification verdicts
- Support for public unauthenticated verification with strict rate limiting and zero leakage of sensitive PII
- Detailed verification report with step-by-step audit breakdown

### Tasks and Subtasks
- [x] **Task 7.1: Verification Engine Pipeline Implementation**
  - [x] Step 1: Uploaded PDF format & security validation.
  - [x] Step 2: Compute SHA-256 fingerprint on exact uploaded bytes.
  - [x] Step 3: Locate original credential via:
    - Path A: Provided Credential ID / QR reference.
    - Path B: Protected HMAC-SHA256 lookup index.
  - [x] Step 4: Retrieve stored credential commitment and protected nonce.
  - [x] Step 5: Recalculate commitment: `keccak256(abi.encode(version, credentialId, issuerId, uploadedFileHash, nonce))`.
  - [x] Step 6: Query Polygon `DocumentRegistry` contract for on-chain commitment and status.
  - [x] Step 7: Validate commitment equality (uploaded recalculation vs on-chain).
  - [x] Step 8: Validate issuer status and signing key authorization on `IssuerRegistry`.
  - [x] Step 9: Validate document lifecycle: active, revoked, expired, blockchain confirmed.
- [x] **Task 7.2: Public & Authenticated Verification Endpoints**
  - [x] Implement `POST /verifications` (accepts file upload + optional credential ID).
  - [x] Implement `GET /public/verify/:credentialId` (public view with privacy protections).
  - [x] Implement `GET /verifications/history` for audit logs.
- [x] **Task 7.3: Detailed Verification Result Codes**
  - [x] Implement distinct codes: `AUTHENTIC_ACTIVE`, `DOCUMENT_MODIFIED`, `NOT_REGISTERED`, `DOCUMENT_REVOKED`, `DOCUMENT_EXPIRED`, `ISSUER_SUSPENDED`, `ISSUER_REVOKED`, `SIGNATURE_INVALID`, `BLOCKCHAIN_PENDING`, `VERIFICATION_UNAVAILABLE`.
- [x] **Task 7.4: Verification Tests**
  - [x] Test original PDF returns `AUTHENTIC_ACTIVE`.
  - [x] Test 1-character modified PDF returns `DOCUMENT_MODIFIED`.
  - [x] Test unregistered PDF returns `NOT_REGISTERED`.
  - [x] Test RPC downtime returns `VERIFICATION_UNAVAILABLE` rather than false positive (7/7 tests pass).

### Deliverables
- NestJS `VerificationModule` and public verification APIs.
- Comprehensive verification test suite covering all positive and negative branches.

### Acceptance Criteria
- Any single-byte modification to an issued PDF is detected and reported as `DOCUMENT_MODIFIED`.
- RPC outages safely report `VERIFICATION_UNAVAILABLE`.

---

## Phase 8: Document Holder Wallet & Sharing

### Objective
Create the individual credential holder portal allowing users to manage credentials issued to them, claim credentials issued prior to account creation, access secure downloads, generate sharing grants with expiration, and view verification history.

### Technical Requirements
- Credential claiming via secure invitation token or email verification
- Time-limited, revocable document sharing tokens (`document_shares`)
- Holder credential categorization (Academic, Employment, Professional, Certificates)

### Tasks and Subtasks
- [x] **Task 8.1: Credential Claiming & Holder Bindings**
  - [x] Implement `POST /wallet/claim` with claim invitation code.
  - [x] Associate anonymous `credential_holders` records with authenticated `users`.
- [x] **Task 8.2: Holder Wallet APIs**
  - [x] Implement `GET /wallet/documents` with category and status filtering.
  - [x] Implement `GET /wallet/documents/:id` with document metadata and lifecycle status.
  - [x] Implement secure temporary download link generator for holder.
- [x] **Task 8.3: Controlled Document Sharing**
  - [x] Implement `POST /documents/:id/shares` (creates time-limited access grant for specific verifier email/org).
  - [x] Implement `DELETE /documents/:id/shares/:shareId` (revokes share access immediately).
  - [x] Implement `GET /wallet/documents/:id/verifications` (holder audit of who verified their document).
- [x] **Task 8.4: Automated Tests**
  - [x] Test claiming workflows, unauthorized access prevention, and share expiration (10/10 tests passing).

### Deliverables
- NestJS `CredentialWalletModule`.
- Complete test suite for holder access and sharing permissions.

### Acceptance Criteria
- Holder can securely view documents, generate share links, and verify access control prevents unauthorized third-party downloads.

---

## Phase 9: Platform Administration & Observability

### Objective
Develop administrative controls, event synchronizer for on-chain events, blockchain reorganization handling, periodic reconciliation worker, and system health observability.

### Technical Requirements
- NestJS `AdminModule`, `AuditModule`, `HealthModule`
- Event indexing worker listening to Polygon logs: `IssuerRegistered`, `IssuerStatusChanged`, `SigningKeyAdded`, `SigningKeyRevoked`, `CredentialIssued`, `CredentialRevoked`
- Reconciliation worker comparing PostgreSQL against Polygon smart contract state

### Tasks and Subtasks
- [x] **Task 9.1: Super Admin APIs & Dashboard Metrics**
  - [x] Implement administrative endpoints for platform statistics, issuer oversight, audit queries.
  - [x] Implement role delegation and emergency pause triggers.
- [x] **Task 9.2: Blockchain Event Indexer Worker**
  - [x] Build background event listener with block reorganization handling and idempotent event log table.
- [x] **Task 9.3: Periodic State Reconciliation Worker**
  - [x] Implement scheduled cron job verifying database state against smart contract records.
  - [x] Flag discrepancies and alert administrators.
- [x] **Task 9.4: System Health & Audit Logging**
  - [x] Implement `GET /health`, `/health/database`, `/health/blockchain`, `/health/storage`.
  - [x] Structured audit logging for all security-critical operations.

### Deliverables
- Admin, Audit, and Health modules.
- Reliable event indexer and reconciliation workers.

### Acceptance Criteria
- All smart contract events are indexed reliably; database drifts are automatically detected by the reconciler.

---

## Phase 10: End-to-End Hardening, Security & Deployment

### Objective
Execute comprehensive security validations, automated end-to-end tests for all mandated scenarios (Test A through Test I), build responsive Next.js frontend interfaces for all 4 user roles, deploy smart contracts to Polygon Amoy testnet, and prepare production deployment guides.

### Technical Requirements
- Next.js enterprise UI covering Admin, Organization, Holder, and Verifier portals
- Automated E2E test suite running through real contracts and services
- Deployment to Polygon Amoy Testnet (Chain ID 80002)
- Hardened Docker Compose and production orchestration manifests

### Tasks and Subtasks
- [x] **Task 10.1: Frontend Implementation (`apps/web`)**
  - [x] Landing page & public verification interface (`/`, `/verify`, `/verify/[id]`).
  - [x] Organization portal (Dashboard, issuance wizard with PDF upload, key manager, document lists).
  - [x] Holder wallet portal (My documents, categories, share manager, download modal).
  - [x] Admin portal (Pending verification reviews, issuer management, emergency controls).
  - [x] Login page with role-based demo fast switcher.
- [x] **Task 10.2: Mandatory End-to-End Scenarios Validation**
  - [x] **Test A (University degree):** University issues degree certificate; employer verifies successfully (`AUTHENTIC_ACTIVE`).
  - [x] **Test B (Modified experience letter):** Company issues letter; 1 character modified; verification detects tampering (`DOCUMENT_MODIFIED`).
  - [x] **Test C (Company suspension):** Company issues document, is suspended; verification distinguishes historical issuance vs current status (`ISSUER_SUSPENDED`).
  - [x] **Test D (Revoked document):** Issuer revokes document on-chain; verification detects revocation (`DOCUMENT_REVOKED`).
  - [x] **Test E (Corrected document):** Original revoked, corrected document issued with `supersedes_document_id`.
  - [x] **Test F (Signing-key compromise):** Key marked compromised; new issuance blocked; historical documents audited (`ISSUER_KEY_COMPROMISED`).
  - [x] **Test G (Unauthorized document access):** Third-party user attempts to download private PDF; access denied with `403 Forbidden`.
  - [x] **Test H (Blockchain outage):** RPC provider fails; system reports `VERIFICATION_UNAVAILABLE` rather than false success.
  - [x] **Test I (Transaction failure):** Blockchain submission reverts; document is NOT marked active (`BLOCKCHAIN_FAILED`).
- [x] **Task 10.3: Polygon Amoy Testnet Deployment & Verification**
  - [x] Deploy scripts for `IssuerRegistry` and `DocumentRegistry` configured for Amoy (Chain ID 80002).
  - [x] Configuration parameters in `.env.example` and contract deployment harness.
- [x] **Task 10.4: Production Documentation & Readiness**
  - [x] Complete `docs/DEPLOYMENT_GUIDE.md` and `docs/PROJECT_STATUS.md`.
  - [x] Finalize README with startup, configuration, and verification instructions.

### Deliverables
- Fully functioning and verified platform across Web, API, Worker, Contracts, and Storage.
- Complete test reports and deployment guides.

### Acceptance Criteria
- All 9 core end-to-end test scenarios pass without manual mock workarounds.
- Zero open critical security vulnerabilities.
