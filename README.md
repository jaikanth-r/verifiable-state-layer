# VSL — Verifiable State Layer

A lightweight integrity layer for application state built with **PostgreSQL, cryptographic hashing, Merkle proofs, and Hyperledger Fabric**.

VSL records versioned state transitions as tamper-evident evidence, groups evidence into Merkle commitments, anchors those commitments to a permissioned blockchain ledger, and provides an independent verification workflow for checking integrity later.

VSL is designed as a **production-oriented academic and portfolio prototype**. The complete system can be reproduced locally without paid cloud infrastructure.

---

## Architecture

```mermaid
graph LR
    U[Web Browser]

    subgraph VSL Application
        W[React + TypeScript<br/>Web UI]
        A[Node.js + Fastify<br/>API]
        C[VSL Core<br/>Hashing + Merkle + Verification]
    end

    P[(PostgreSQL<br/>Application State)]
    F[Hyperledger Fabric<br/>Anchor Ledger]

    U -->|HTTP / JSON| W
    W -->|API requests| A
    A --> C
    A -->|SQL| P
    C -->|Submit Merkle root| F
    F -->|Anchor confirmation| C
Architecture Components
Frontend (apps/web): a React + TypeScript application providing the Overview, Records, Verify, and Audit workspaces.
API (apps/api): a Fastify service responsible for authentication, authorization, resources, evidence creation, history, batching, anchoring, verification, auditing, and overview data.
VSL Core (packages/vsl-core): the domain and integrity layer containing evidence, repository, batching, anchoring, and verification logic.
Crypto (packages/crypto): canonicalization and SHA-256 hashing primitives used to derive deterministic state commitments.
Merkle (packages/merkle): Merkle tree construction, batching, inclusion proofs, and proof verification.
PostgreSQL: persistent application state, resource versions, evidence events, anchor batches, memberships, and audit events.
Hyperledger Fabric: permissioned blockchain infrastructure used to anchor Merkle roots.
Integrity Model
The core VSL workflow is:
Application state
      │
      ▼
Evidence event
      │
      ▼
Canonical representation
      │
      ▼
SHA-256 state hash
      │
      ▼
Version chain
      │
      ▼
Merkle batch
      │
      ▼
Merkle root
      │
      ▼
Hyperledger Fabric anchor
      │
      ▼
Independent verification
Each evidence version contains its state hash and the previous version's state hash.
This creates a linked history of state transitions.
Evidence events can then be grouped into Merkle batches. The Merkle root is anchored to Hyperledger Fabric so that the commitment can later be independently checked.
What VSL Provides
Versioned application records
Tamper-evident state history
SHA-256 state hashing
Previous-state hash chaining
Merkle batching
Merkle inclusion proofs
Hyperledger Fabric anchoring
Independent evidence verification
Tenant-aware resource access
Role-aware authorization
Security audit logging
Live system overview
PostgreSQL persistence
Docker-based local infrastructure
Reproducible zero-cost local development
Development authentication for local demonstrations
Optional OIDC validation path
Tech Stack
Frontend: React 19, TypeScript, Vite
Backend: Node.js 20, Fastify, TypeScript
Database: PostgreSQL 16
Cryptography: SHA-256
Merkle layer: TypeScript
Blockchain: Hyperledger Fabric
Containerization: Docker, Docker Compose
Testing: Vitest
Package management: npm workspaces
Authentication: Development authenticator + OIDC validation path

Repository Structure
verifiable-state-layer/
│
├── apps/
│   ├── api/                         # Fastify API
│   │   ├── src/
│   │   └── Dockerfile
│   │
│   └── web/                         # React frontend
│       ├── src/
│       └── Dockerfile
│
├── packages/
│   ├── crypto/                      # Hashing + canonicalization
│   ├── merkle/                      # Merkle tree + proofs
│   ├── shared/                      # Shared types
│   └── vsl-core/                    # Core domain + verification
│
├── blockchain/                      # Blockchain-related assets
├── database/
│   └── migrations/                  # PostgreSQL migrations
│
├── infra/                           # Infrastructure assets
├── scripts/
│   └── migrate.ts                   # Migration runner
│
├── tests/                           # Additional test assets
│
├── docs/
│   └── assets/                      # Screenshots / diagrams
│
├── docker-compose.yml
├── LICENSE
├── package.json
└── README.md
Prerequisites
Git
Node.js 20+
npm
Docker Engine
Docker Compose
A local Hyperledger Fabric network for blockchain integration
The project is intended for local development and demonstration and does not require paid cloud infrastructure.
How to Run Locally
1. Clone the repository
git clone https://github.com/jaikanth-r/verifiable-state-layer.git
cd verifiable-state-layer
2. Install dependencies
npm ci
3. Start PostgreSQL
docker compose up -d postgres
4. Configure the API
Create a local environment file:
cp .env.example .env
For the local development workflow:
AUTH_MODE=development
DATABASE_URL=postgresql://vsl:vsl_dev_password@127.0.0.1:5432/vsl
Development authentication exists only to make the local demonstration reproducible.
Do not use development authentication as a production security mechanism.
5. Run database migrations
npm run db:migrate
Applied migrations are tracked in:
schema_migrations
6. Start the API
npm run dev --workspace=@vsl/api
The API exposes:
GET /health
GET /ready
7. Start the frontend
In another terminal:
npm run dev --workspace=@vsl/web -- --host 0.0.0.0
Open the Vite URL displayed by the terminal.
Application
The web application is divided into four primary workspaces.
Overview
Displays live system metrics, recent records, anchoring state, and recent audit activity.
Records
Create records, record state transitions, inspect version history, and protect evidence.
Verify
Select an evidence event and independently inspect its state chain, Merkle proof, and blockchain anchor.
Audit
Review security-sensitive activity with filtering, pagination, and expandable metadata.
End-to-End Workflow
Create record
      │
      ▼
Create evidence event
      │
      ▼
Calculate state hash
      │
      ▼
Persist version + previous hash
      │
      ▼
Create Merkle batch
      │
      ▼
Calculate Merkle root
      │
      ▼
Anchor root to Hyperledger Fabric
      │
      ▼
Verify evidence
      │
      ├── state chain
      ├── Merkle proof
      └── blockchain anchor
      │
      ▼
Audit activity
API Overview
GET  /health
GET  /ready

GET  /v1/overview

GET  /v1/resources
POST /v1/resources

GET  /v1/resources/:resourceId/history
POST /v1/resources/:resourceId/events
POST /v1/resources/:resourceId/protect

POST /v1/batches
GET  /v1/batches/:batchId
POST /v1/batches/:batchId/anchor

GET  /v1/verify/:eventId

GET  /v1/audit
Screenshots
The following screenshots are captured from the running VSL application.
Overview
Live resource, evidence, anchoring, and security metrics.
Records
Create protected records and inspect versioned evidence history.
Verification
Inspect independent verification results, Merkle proofs, and Fabric anchoring.
Audit
Review security-sensitive activity with filtering and expandable metadata.
Testing
Run the complete workspace test suite:
npm test
Run the complete build:
npm run build
Run TypeScript checks:
npm run typecheck
The repository contains:
API tests
authentication tests
authorization tests
PostgreSQL integration tests
Merkle tests
cryptographic tests
anchoring tests
Hyperledger Fabric integration tests
Security Model
VSL separates authentication from application authorization.
Identity
   │
   ▼
Authenticator
   │
   ▼
VSL user
   │
   ▼
Tenant membership
   │
   ▼
Role
   │
   ▼
Authorization
   │
   ▼
Protected resource
The OIDC authentication path validates:
JWT signature
issuer
audience
subject
The subject is then resolved through the VSL identity database to obtain the corresponding user, tenant, and role.
Production explicitly rejects the development authentication mode.
Database Migrations
Database migrations are stored under:
database/migrations/
Run:
npm run db:migrate
The migration runner:
creates the migration tracking table when necessary;
discovers migrations in sorted order;
skips migrations already applied;
executes each new migration transactionally;
records the migration after successful completion.
Development Authentication
The development authenticator exists solely for local demonstrations and automated testing.
This allows the complete application workflow to run without requiring a hosted identity provider.
It must not be treated as production authentication.
When:
NODE_ENV=production
the application rejects:
AUTH_MODE=development
and requires an explicit production authentication mode.
OIDC Authentication
The API supports OIDC validation using:
OIDC_ISSUER
OIDC_AUDIENCE
OIDC_JWKS_URL
The expected production flow is:
OIDC Provider
      │
      ▼
Access token
      │
      ▼
VSL API
      │
      ├── signature verification
      ├── issuer validation
      ├── audience validation
      └── subject resolution
              │
              ▼
        VSL identity database
              │
              ▼
         tenant + role
The local development workflow does not require OIDC.
Troubleshooting
Symptom	Likely cause	Fix
DATABASE_URL is required	API started without database configuration	Configure DATABASE_URL
AUTH_MODE is required when NODE_ENV=production	Production started without explicit auth mode	Configure production authentication
AUTH_MODE=development is not allowed...	Development authentication attempted in production	Use OIDC
Web cannot reach API	Incorrect API base URL or API is not running	Check API URL and /health
Database schema is missing	Migrations were not applied	Run npm run db:migrate
Fabric anchoring fails	Fabric network/configuration unavailable	Start Fabric and verify Fabric settings
Zero-Cost Development
VSL does not require paid cloud infrastructure for its intended academic/demo use.
The local stack uses open-source components:
React
Node.js
Fastify
PostgreSQL
Docker
Hyperledger Fabric
Vitest
This repository is intended to be cloned, run, tested, and inspected locally.
Project Scope
VSL is intentionally a:
lightweight, low-traffic, self-hosted academic and portfolio prototype
It is not presented as a managed SaaS platform or high-availability production service.
A real production deployment would require additional operational controls such as:
TLS termination
centralized secret management
backups
monitoring
alerting
infrastructure redundancy
production identity infrastructure
disaster recovery
deployment automation
The purpose of this repository is to provide a technically credible and reproducible implementation of verifiable application state using cryptography, Merkle commitments, and permissioned blockchain anchoring.
Design Principles
Explicit state transitions
Important state changes are recorded as evidence events instead of silently overwriting history.
Tamper-evident history
Each version contains a state hash and reference to the previous state hash.
Independently verifiable commitments
Merkle proofs allow individual evidence events to be checked against a committed Merkle root.
Separate application data from blockchain commitments
PostgreSQL stores application state while Hyperledger Fabric provides the permissioned blockchain commitment layer.
Fail closed in production
Development authentication is explicitly rejected when running in production mode.
Contributing
Contributions, experiments, fixes, and improvements are welcome.
Before submitting changes:
npm test
npm run build
Please preserve:
tenant isolation
authorization boundaries
evidence version integrity
Merkle verification correctness
auditability
License
MIT — see LICENSE.
Author
Jaikanth
VSL is an open-source academic and portfolio project exploring verifiable application state, cryptographic integrity, and blockchain-backed evidence.
