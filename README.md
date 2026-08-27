# VSL — Verifiable State Layer

A lightweight integrity layer for application state, built with **PostgreSQL, cryptographic hashing, Merkle proofs, and Hyperledger Fabric**.

VSL records versioned state transitions as tamper-evident evidence, groups that evidence into Merkle commitments, anchors those commitments to a permissioned blockchain ledger, and provides an independent verification workflow for checking integrity later. It's designed as a production-oriented academic and portfolio prototype — the full system reproduces locally with no paid infrastructure.

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
```

- **Frontend** (`apps/web`): React + TypeScript app with Overview, Records, Verify, and Audit workspaces.
- **API** (`apps/api`): Fastify service handling auth, authorization, resources, evidence creation, history, batching, anchoring, verification, and audit.
- **VSL Core** (`packages/vsl-core`): domain and integrity logic — evidence, repository, batching, anchoring, verification.
- **Crypto** (`packages/crypto`): canonicalization and SHA-256 hashing used to derive deterministic state commitments.
- **Merkle** (`packages/merkle`): Merkle tree construction, batching, inclusion proofs, and proof verification.
- **PostgreSQL**: application state, resource versions, evidence events, anchor batches, memberships, audit events.
- **Hyperledger Fabric**: permissioned blockchain used to anchor Merkle roots.

## Integrity Model

```text
Application state → Evidence event → Canonical representation → SHA-256 state hash
    → Version chain → Merkle batch → Merkle root → Hyperledger Fabric anchor
    → Independent verification
```

Each evidence version stores its own state hash plus the previous version's hash, forming a linked history of state transitions. Evidence events are grouped into Merkle batches, and the Merkle root is anchored to Hyperledger Fabric so the commitment can be independently checked later.

## What VSL Provides

- Versioned application records with tamper-evident history
- SHA-256 state hashing with previous-state hash chaining
- Merkle batching and inclusion proofs
- Hyperledger Fabric anchoring
- Independent evidence verification
- Tenant-aware resource access and role-aware authorization
- Security audit logging and a live system overview
- Reproducible, zero-cost local development via Docker

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Backend:** Node.js 20, Fastify, TypeScript
- **Database:** PostgreSQL 16
- **Cryptography:** SHA-256, Merkle trees (TypeScript)
- **Blockchain:** Hyperledger Fabric
- **Containerization:** Docker, Docker Compose
- **Testing:** Vitest
- **Auth:** Development authenticator for local demos, plus an OIDC validation path

## Repository Structure

```text
verifiable-state-layer/
├── apps/
│   ├── api/              Fastify API
│   └── web/              React frontend
├── packages/
│   ├── crypto/           Hashing + canonicalization
│   ├── merkle/           Merkle tree + proofs
│   ├── shared/           Shared types
│   └── vsl-core/         Core domain + verification
├── blockchain/           Blockchain-related assets
├── database/migrations/  PostgreSQL migrations
├── infra/                Infrastructure assets
├── scripts/migrate.ts    Migration runner
├── docs/assets/          Screenshots / diagrams
├── docker-compose.yml
├── LICENSE
└── README.md
```

## Prerequisites

- Git, Node.js 20+, npm
- Docker Engine + Docker Compose
- A local Hyperledger Fabric network for blockchain integration

No paid cloud infrastructure is required for local development or demonstration.

## How to Run Locally

### 1. Clone and install
```bash
git clone https://github.com/jaikanth-r/verifiable-state-layer.git
cd verifiable-state-layer
npm ci
```

### 2. Start PostgreSQL
```bash
docker compose up -d postgres
```

### 3. Configure the API
```bash
cp .env.example .env
```
For local development:
```env
AUTH_MODE=development
DATABASE_URL=postgresql://vsl:vsl_dev_password@127.0.0.1:5432/vsl
```
Development authentication exists only to make the local demo reproducible — **never use it as a production security mechanism.**

### 4. Run migrations
```bash
npm run db:migrate
```

### 5. Start the API
```bash
npm run dev --workspace=@vsl/api
```
Exposes `GET /health` and `GET /ready`.

### 6. Start the frontend
```bash
npm run dev --workspace=@vsl/web -- --host 0.0.0.0
```
Open the URL Vite prints in the terminal.

## Application Workspaces

- **Overview** — live system metrics, recent records, anchoring state, recent audit activity.
- **Records** — create records, record state transitions, inspect version history, protect evidence.
- **Verify** — select an evidence event and independently inspect its state chain, Merkle proof, and blockchain anchor.
- **Audit** — review security-sensitive activity with filtering, pagination, and expandable metadata.

## End-to-End Workflow

```text
Create record → Create evidence event → Calculate state hash
    → Persist version + previous hash → Create Merkle batch → Calculate Merkle root
    → Anchor root to Hyperledger Fabric → Verify evidence (state chain, Merkle proof, anchor)
    → Audit activity
```

## API Overview

```text
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
```

## Screenshots

### Overview
![VSL Overview](docs/assets/overview.png)
Live resource, evidence, anchoring, and security metrics.

### Records
![VSL Records](docs/assets/records.png)
Create protected records and inspect versioned evidence history.

### Verification
![VSL Verification](docs/assets/verify.png)
Independent verification results, Merkle proofs, and Fabric anchoring.

### Audit
![VSL Audit](docs/assets/audit.png)
Security-sensitive activity with filtering and expandable metadata.

## Testing

```bash
npm test          # full workspace test suite
npm run build     # full build
npm run typecheck # TypeScript checks
```

Covers: API tests, authentication tests, authorization tests, PostgreSQL integration tests, Merkle tests, cryptographic tests, anchoring tests, Hyperledger Fabric integration tests.

## Security Model

```text
Identity → Authenticator → VSL user → Tenant membership → Role → Authorization → Protected resource
```

The OIDC path validates JWT signature, issuer, audience, and subject, then resolves the subject through the VSL identity database to get the user, tenant, and role. **Production explicitly rejects development authentication.**

## Database Migrations

Stored under `database/migrations/`. Run with `npm run db:migrate` — the runner creates the tracking table if needed, discovers migrations in sorted order, skips already-applied ones, and executes each new migration transactionally.

## Authentication Modes

**Development** — for local demos and automated testing only. When `NODE_ENV=production`, the app rejects `AUTH_MODE=development` and requires an explicit production auth mode.

**OIDC** — configured via `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URL`. Validates the access token (signature, issuer, audience), then resolves tenant + role from the VSL identity database. Not required for local development.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `DATABASE_URL is required` | API started without DB config | Configure `DATABASE_URL` |
| `AUTH_MODE is required when NODE_ENV=production` | Production started without explicit auth mode | Configure production authentication |
| `AUTH_MODE=development is not allowed...` | Dev auth attempted in production | Use OIDC |
| Web cannot reach API | Wrong API base URL or API not running | Check API URL and `/health` |
| Database schema is missing | Migrations not applied | Run `npm run db:migrate` |
| Fabric anchoring fails | Fabric network/config unavailable | Start Fabric, verify settings |

## Project Scope

VSL is intentionally a **lightweight, low-traffic, self-hosted academic and portfolio prototype** — not a managed SaaS platform or high-availability service. A real production deployment would need TLS termination, centralized secret management, backups, monitoring, alerting, infrastructure redundancy, production identity infrastructure, disaster recovery, and deployment automation. The goal here is a technically credible, reproducible implementation of verifiable application state using cryptography, Merkle commitments, and permissioned blockchain anchoring.

## Design Principles

- **Explicit state transitions** — changes are recorded as evidence events, never silently overwritten.
- **Tamper-evident history** — each version carries a state hash plus a reference to the previous hash.
- **Independently verifiable commitments** — Merkle proofs check individual events against a committed root.
- **Separation of concerns** — PostgreSQL holds application state; Hyperledger Fabric provides the blockchain commitment layer.
- **Fail closed in production** — development authentication is explicitly rejected outside local/dev use.

## Contributing

Before submitting changes:
```bash
npm test
npm run build
```
Please preserve tenant isolation, authorization boundaries, evidence version integrity, Merkle verification correctness, and auditability.

## License
MIT — see [LICENSE](LICENSE).

## Author
**Jaikanth** — VSL is an open-source academic and portfolio project exploring verifiable application state, cryptographic integrity, and blockchain-backed evidence.
