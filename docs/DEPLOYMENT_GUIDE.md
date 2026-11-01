# Deployment & Operations Guide

## 1. Overview and Deployment Topology

The platform is designed for flexible deployment across local containerized development environments, staging networks (**Polygon Amoy Testnet**), and production multi-cloud infrastructures (**Polygon PoS Mainnet**).

```text
                                  PRODUCTION DEPLOYMENT TOPOLOGY
                                  
                       [ Cloudflare WAF / CDN / SSL Termination ]
                                           |
                   +-----------------------+-----------------------+
                   |                                               |
                   v                                               v
        [ Next.js Web Frontend ]                        [ NestJS API Gateway ]
          (Vercel or ECS / K8s)                         (ECS Fargate / K8s)
                                                                   |
                                                   +---------------+---------------+
                                                   |                               |
                                                   v                               v
                                          [ BullMQ Workers ]               [ PostgreSQL 16 ]
                                         (Background cluster)              (RDS Multi-AZ)
                                                   |                               |
                                                   v                               v
                                             [ Redis 7 ]                  [ Encrypted S3 ]
                                            (ElastiCache)                 (KMS-CMK Protected)
                                                   |
                                                   v RPC (Alchemy / Infura / QuickNode)
                                           [ Polygon PoS ]
```

---

## 2. Environment Configurations

| Variable Name | Local Development | Staging (Polygon Amoy) | Production (Polygon Mainnet) |
|---|---|---|---|
| `NODE_ENV` | `development` | `staging` | `production` |
| `API_PORT` | `4000` | `4000` | `4000` |
| `WEB_URL` | `http://localhost:3000` | `https://staging.docauth.example.com` | `https://docauth.example.com` |
| `BLOCKCHAIN_NETWORK` | `hardhat` / `amoy` | `polygon-amoy` | `polygon-mainnet` |
| `BLOCKCHAIN_CHAIN_ID` | `31337` / `80002` | `80002` | `137` |
| `POLYGON_RPC_URL` | `http://127.0.0.1:8545` | `https://rpc-amoy.polygon.technology/` | Managed QuickNode / Alchemy RPC |
| `STORAGE_PROVIDER` | `minio` | `s3` / `minio` | `s3` (AWS S3 Private) |
| `KMS_PROVIDER` | `local` | `local` / `aws` | `aws-kms` |

---

## 3. Local Development Setup

### 3.1 Prerequisites
- **Node.js:** `>= 20.x` (Tested on Node v24.22.1)
- **Package Manager:** `pnpm >= 9.x` (Tested on pnpm 11.22.0)
- **Docker & Docker Compose** (or native local services / WSL2)
- **Git**

### 3.2 Step 1: Clone and Install Dependencies
```bash
# Clone the repository
git clone <repository_url>
cd Minor_Project

# Install all monorepo dependencies
pnpm install
```

### 3.3 Step 2: Environment Configuration
Copy the provided `.env.example` to `.env` in the root and in the respective apps:
```bash
cp .env.example .env
```

### 3.4 Step 3: Launch Local Supporting Services
Start PostgreSQL, Redis, and MinIO via Docker Compose:
```bash
docker compose up -d
```
Verify container status:
- PostgreSQL running on `localhost:5432`
- Redis running on `localhost:6379`
- MinIO running on `localhost:9000` (Console on `localhost:9001`)

### 3.5 Step 4: Run Database Migrations & Seeds
```bash
# Generate Prisma Client
pnpm db:generate

# Run migrations against local PostgreSQL
pnpm db:migrate

# Seed initial document types, super admin, and demo organization
pnpm db:seed
```

### 3.6 Step 5: Compile & Test Smart Contracts
```bash
# Compile Solidity contracts
pnpm contracts:compile

# Run local Hardhat tests
pnpm contracts:test
```

### 3.7 Step 6: Start Full-Stack Development
```bash
# Start all apps (Web, API, Worker, Local Hardhat Node) concurrently
pnpm dev
```
- Frontend: `http://localhost:3000`
- API Backend & Swagger Docs: `http://localhost:4000/api/docs`
- MinIO Storage Console: `http://localhost:9001` (Credentials: `minioadmin / minioadmin`)

---

## 4. Polygon Amoy Testnet Deployment

### 4.1 Faucet and Account Funding
1. Generate or configure a dedicated deployer/relayer wallet address.
2. Obtain Testnet POL from the official Polygon Faucet:
   - https://faucet.polygon.technology/
3. Confirm funds on Polygon Amoy Explorer:
   - https://amoy.polygonscan.com/address/<deployer_address>

### 4.2 Deploy Smart Contracts
Execute the Hardhat deployment script targeting Amoy:
```bash
pnpm contracts:deploy:amoy
```
The deployment script outputs:
```text
Deploying to Polygon Amoy (Chain ID: 80002)...
Deployer Account: 0x1234...
IssuerRegistry deployed to: 0x5678...
DocumentRegistry deployed to: 0x9abc...
Verifying contracts on PolygonScan...
Contracts successfully verified!
```

### 4.3 Update Application Configuration
Update `.env` with the newly deployed contract addresses:
```env
ISSUER_REGISTRY_ADDRESS=0x5678...
DOCUMENT_REGISTRY_ADDRESS=0x9abc...
BLOCKCHAIN_CHAIN_ID=80002
POLYGON_RPC_URL=https://rpc-amoy.polygon.technology/
```

Restart API and worker services:
```bash
pnpm api:restart
pnpm worker:restart
```

---

## 5. Production Hardening Checklist

- [ ] **Secrets Isolation:** No production private keys, database passwords, or JWT secrets stored in plaintext `.env` files. Utilize AWS Secrets Manager, HashiCorp Vault, or GCP Secret Manager.
- [ ] **KMS Envelope Encryption:** Configure AWS KMS Customer Managed Keys (CMK) with key rotation enabled for envelope encryption of nonces and document hashes.
- [ ] **S3 Bucket Restrictions:** Enable Default Bucket Encryption (`aws:kms`), S3 Object Lock, Block All Public Access, and enforce HTTPS (`aws:SecureTransport`) in bucket policy.
- [ ] **Relayer Security:** Relayer private key protected in HSM/KMS. Relayer wallet funded with minimum necessary gas reserves with auto-top-up monitoring.
- [ ] **Rate Limiting:** Protect `/api/v1/verifications` and `/api/v1/auth/login` using Redis-backed token bucket rate limiters to prevent DoS.
- [ ] **Health & Telemetry:** Expose Prometheus metrics, structured JSON logs via Pino, and configure uptime monitors on `/api/v1/health`.

