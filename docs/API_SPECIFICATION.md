# REST API Specification (v1)

## 1. Global API Standards

- **Base URL:** `/api/v1`
- **Format:** JSON (`application/json`) except file upload endpoints (`multipart/form-data`)
- **Authentication:** Bearer JWT in `Authorization: Bearer <access_token>` or secure HTTP-only cookies
- **Error Format:** Standardized RFC 7807 compliant Problem Details
- **Swagger / OpenAPI Documentation:** Accessible at `/api/docs`

### Standard Response Envelope
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-10-31T14:30:00.000Z",
    "requestId": "req_01j7abc123"
  }
}
```

### Standard Error Envelope
```json
{
  "success": false,
  "error": {
    "code": "DOCUMENT_MODIFIED",
    "message": "Calculated commitment does not match the on-chain blockchain record.",
    "details": []
  },
  "meta": {
    "timestamp": "2026-10-31T14:30:00.000Z",
    "requestId": "req_01j7abc123"
  }
}
```

---

## 2. Authentication & Identity Endpoints

### 2.1 Register User
`POST /api/v1/auth/register`
- **Auth:** Public
- **Request Body:**
  ```json
  {
    "email": "rahul.sharma@example.com",
    "password": "SecurePassword#2026",
    "displayName": "Rahul Sharma"
  }
  ```
- **Responses:**
  - `201 Created`: User registered successfully. Returns user object.
  - `409 Conflict`: Email already registered.

### 2.2 Login User
`POST /api/v1/auth/login`
- **Auth:** Public (Rate-limited: 5 attempts/min per IP)
- **Request Body:**
  ```json
  {
    "email": "rahul.sharma@example.com",
    "password": "SecurePassword#2026"
  }
  ```
- **Responses:**
  - `200 OK`:
    ```json
    {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "rt_8f192b...",
      "expiresIn": 900,
      "user": {
        "id": "c1f7b02e-9d2a-4a6c-941f-a35f9923812f",
        "email": "rahul.sharma@example.com",
        "displayName": "Rahul Sharma",
        "mfaRequired": false,
        "memberships": []
      }
    }
    ```

### 2.3 Refresh Session
`POST /api/v1/auth/refresh`
- **Auth:** Refresh Token
- **Request Body:**
  ```json
  {
    "refreshToken": "rt_8f192b..."
  }
  ```
- **Responses:**
  - `200 OK`: New access token and rotated refresh token.
  - `401 Unauthorized`: Token expired, revoked, or reuse detected.

### 2.4 Logout
`POST /api/v1/auth/logout`
- **Auth:** Bearer Token
- **Responses:**
  - `200 OK`: Active session invalidated.

### 2.5 Multi-Factor Authentication
- `POST /api/v1/auth/mfa/enable`: Generates TOTP secret and QR code for authenticator apps.
- `POST /api/v1/auth/mfa/verify`: Confirms TOTP code and activates MFA requirement.

### 2.6 Current User Profile
`GET /api/v1/auth/me`
- **Auth:** Bearer Token
- **Responses:**
  - `200 OK`: Detailed user profile, permissions, and active organization roles.

---

## 3. Organization Management Endpoints

### 3.1 Apply for Organization Verification
`POST /api/v1/organizations/apply`
- **Auth:** Bearer Token (Authenticated user becomes applicant and initial ORG_ADMIN upon approval)
- **Content-Type:** `multipart/form-data`
- **Fields:**
  - `legalName`: string
  - `registrationNumber`: string (encrypted upon receipt)
  - `organizationType`: `UNIVERSITY` | `CORPORATION` | `GOVERNMENT` | `TRAINING_INSTITUTE` | `OTHER`
  - `website`: string
  - `contactEmail`: string
  - `evidenceFiles`: File[] (PDF, PNG, max 10MB each)
- **Responses:**
  - `201 Created`: Application received with status `PENDING`.

### 3.2 Get Current Organization
`GET /api/v1/organizations/me`
- **Auth:** Bearer Token + `X-Organization-Id` header
- **Responses:**
  - `200 OK`: Organization profile, verification status, and on-chain `issuer_id`.

### 3.3 Manage Members
- `GET /api/v1/organizations/me/members`: List organizational members and roles.
- `POST /api/v1/organizations/me/members`: Invite user with role (`ORG_ADMIN`, `ISSUER`, `REVIEWER`, `MEMBER`).

---

## 4. Platform Administration Endpoints (Super Admin)

### 4.1 List Organization Verification Cases
`GET /api/v1/admin/organizations?status=PENDING`
- **Auth:** Bearer Token (`SUPER_ADMIN` role required)
- **Responses:**
  - `200 OK`: Paginated list of pending applications with submitted evidence links.

### 4.2 Review Application Case
`GET /api/v1/admin/organizations/:id`
- **Responses:**
  - `200 OK`: Full application dossier including decrypted details (for authorized reviewer).

### 4.3 Approve Organization
`POST /api/v1/admin/organizations/:id/approve`
- **Auth:** Bearer Token (`SUPER_ADMIN`)
- **Request Body:**
  ```json
  {
    "reviewerNotes": "Verified against state corporate registry records."
  }
  ```
- **Responses:**
  - `200 OK`:
    - Organization status transitioned to `APPROVED`.
    - Generates 32-byte opaque `issuerId`.
    - Enqueues blockchain registration transaction.

### 4.4 Suspend / Reactivate Organization
- `POST /api/v1/admin/organizations/:id/suspend`: Halts new document issuances.
- `POST /api/v1/admin/organizations/:id/reactivate`: Restores active issuance capability.

---

## 5. Issuer Signing Key Management

### 5.1 List Issuer Signing Keys
`GET /api/v1/organizations/me/signing-keys`
- **Auth:** Bearer Token (`ORG_ADMIN`)
- **Responses:**
  - `200 OK`: Array of key versions, public addresses, statuses, and effective dates.

### 5.2 Register Initial Signing Key
`POST /api/v1/organizations/me/signing-keys`
- **Request Body:**
  ```json
  {
    "walletAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  }
  ```
- **Responses:**
  - `201 Created`: Key v1 registered. Enqueues on-chain registration.

### 5.3 Rotate Signing Key
`POST /api/v1/organizations/me/signing-keys/rotate`
- **Request Body:**
  ```json
  {
    "newWalletAddress": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
  }
  ```
- **Responses:**
  - `200 OK`: Provisions Key version $v+1$.

### 5.4 Revoke / Mark Compromised
`POST /api/v1/organizations/me/signing-keys/:id/revoke`
- **Request Body:**
  ```json
  {
    "isCompromised": true,
    "compromisedAt": "2026-10-30T12:00:00.000Z",
    "reason": "Developer machine compromised by malware."
  }
  ```

---

## 6. Document Issuance Endpoints

### 6.1 Initiate Upload Session
`POST /api/v1/documents/upload-session`
- **Auth:** Bearer Token (`ISSUER` or `ORG_ADMIN` role)
- **Request Body:**
  ```json
  {
    "documentTypeCode": "EXPERIENCE_LETTER",
    "holderEmail": "rahul.sharma@example.com",
    "holderSubjectReference": "EMP-2024-8891",
    "expiresAt": null
  }
  ```
- **Responses:**
  - `201 Created`: Returns `uploadSessionId` and pre-signed S3 upload URL.

### 6.2 Finalize Upload & Calculate Cryptographic Hashes
`POST /api/v1/documents/:id/finalize-upload`
- **Process:** Validates quarantine PDF, calculates SHA-256 on exact raw bytes, generates `credentialId` and random `nonce`, computes Keccak-256 `commitment`.
- **Responses:**
  - `200 OK`:
    ```json
    {
      "credentialId": "0x4a7e91...",
      "commitment": "0xb3c812...",
      "documentHash": "0x89fd10...",
      "keyVersion": 1,
      "eip712Payload": {
        "domain": {
          "name": "DecentralizedDocumentPlatform",
          "version": "1",
          "chainId": 80002,
          "verifyingContract": "0x12345..."
        },
        "types": {
          "IssueCredential": [
            { "name": "issuerId", "type": "bytes32" },
            { "name": "credentialId", "type": "bytes32" },
            { "name": "commitment", "type": "bytes32" },
            { "name": "issuedAt", "type": "uint64" },
            { "name": "expiresAt", "type": "uint64" },
            { "name": "keyVersion", "type": "uint32" },
            { "name": "schemaVersion", "type": "uint32" }
          ]
        },
        "message": { ... }
      }
    }
    ```

### 6.3 Authorize and Submit Issuance
`POST /api/v1/documents/:id/issue`
- **Request Body:**
  ```json
  {
    "signature": "0x28f102..."
  }
  ```
- **Process:** Validates signature against registered `IssuerKey` on backend, moves file to permanent encrypted storage, creates transactional outbox entry, returns `PENDING_BLOCKCHAIN`.
- **Responses:**
  - `202 Accepted`: Enqueued for Polygon blockchain mining.

### 6.4 Revoke Document
`POST /api/v1/documents/:id/revoke`
- **Request Body:**
  ```json
  {
    "reason": "Holder committed employment fraud.",
    "signature": "0x8a92..."
  }
  ```

---

## 7. Document Verification Endpoints

### 7.1 Verify Uploaded Document
`POST /api/v1/verifications`
- **Auth:** Public (Strict rate-limit: 20 req/min per IP)
- **Content-Type:** `multipart/form-data`
- **Fields:**
  - `document`: File (PDF)
  - `credentialId`: string (optional, hex-encoded 32 bytes)
- **Responses:**
  - `200 OK`: Detailed verification result:
    ```json
    {
      "status": "AUTHENTIC_ACTIVE",
      "verdict": "Document is authentic, issued by an authorized organization, and confirmed on Polygon PoS.",
      "checks": {
        "documentIntegrity": {
          "status": "PASSED",
          "uploadedSha256": "89fd102...",
          "commitmentMatched": true
        },
        "issuerAuthenticity": {
          "status": "PASSED",
          "issuerId": "0x789...",
          "issuerLegalName": "Company A Technologies Pvt Ltd",
          "keyVersion": 1,
          "signatureValid": true
        },
        "organizationalTrust": {
          "status": "PASSED",
          "issuerStatus": "ACTIVE",
          "adminAccreditation": "VERIFIED"
        },
        "lifecycle": {
          "isRevoked": false,
          "isExpired": false,
          "blockchainStatus": "CONFIRMED",
          "transactionHash": "0x56a...",
          "blockNumber": 12849102
        }
      }
    }
    ```

### 7.2 Public Credential Status View
`GET /api/v1/public/verify/:credentialId`
- **Auth:** Public
- **Description:** Returns the public cryptographic status without exposing personal details or unshared documents.

---

## 8. Holder Credential Wallet Endpoints

### 8.1 List My Credentials
`GET /api/v1/wallet/documents?category=EMPLOYMENT`
- **Auth:** Bearer Token (Holder)
- **Responses:**
  - `200 OK`: List of credentials owned by the user.

### 8.2 Claim Unregistered Issuance
`POST /api/v1/wallet/claim`
- **Request Body:**
  ```json
  {
    "claimInvitationCode": "INV-8910-XKZ"
  }
  ```
- **Responses:**
  - `200 OK`: Binds credential to holder user account.

### 8.3 Share Credential
`POST /api/v1/documents/:id/shares`
- **Request Body:**
  ```json
  {
    "expiresInHours": 72,
    "recipientEmail": "hr@companyb.com"
  }
  ```
- **Responses:**
  - `201 Created`: Returns secure share link and one-time access token.

---

## 9. System Health & Diagnostics

- `GET /api/v1/health`: Overall service health status.
- `GET /api/v1/health/database`: PostgreSQL connection pool status and migration state.
- `GET /api/v1/health/blockchain`: Polygon RPC node latency, current block, and relayer gas balance.
- `GET /api/v1/health/storage`: MinIO / S3 bucket accessibility check.

