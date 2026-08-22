import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it
} from "vitest";
import { Pool } from "pg";

import { createEvidenceEvent } from "../../evidence.js";
import { MerkleBatchService } from "../batch-service.js";
import { FabricAnchorAdapter } from "../../blockchain/fabric-anchor-adapter.js";

async function getTestTenantId(): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `
    SELECT id
    FROM tenants
    WHERE slug = 'development'
    `
  );

  const tenantId = result.rows[0]?.id;

  if (!tenantId) {
    throw new Error("Development tenant not found");
  }

  return tenantId;
}

const pool = new Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ??
    "postgresql://vsl:vsl_dev_password@127.0.0.1:5432/vsl_test"
});

const HOME = process.env.HOME!;

const fabricAdapterPromise = FabricAnchorAdapter.connect({
  peerEndpoint: "localhost:7051",
  tlsRootCertPath:
    `${HOME}/fabric-samples/test-network/organizations/peerOrganizations/` +
    `org1.example.com/tlsca/tlsca.org1.example.com-cert.pem`,
  mspId: "Org1MSP",
  identityCertPath:
    `${HOME}/fabric-samples/test-network/organizations/peerOrganizations/` +
    `org1.example.com/users/Admin@org1.example.com/msp/signcerts/` +
    `Admin@org1.example.com-cert.pem`,
  privateKeyPath:
    `${HOME}/fabric-samples/test-network/organizations/peerOrganizations/` +
    `org1.example.com/users/Admin@org1.example.com/msp/keystore/priv_sk`,
  channelName: "vslchannel",
  chaincodeName: "vsl-anchor"
});

beforeEach(async () => {
  await pool.query(`
    TRUNCATE
      evidence_events,
      resource_versions,
      resources,
      anchor_batches
    RESTART IDENTITY CASCADE
  `);
});

afterAll(async () => {
  const adapter = await fabricAdapterPromise;
  adapter.close();
  await pool.end();
});

async function insertEvidence(
  eventId: string,
  resourceId: string,
  version: number,
  previousStateHash: string | null
) {
  const event = createEvidenceEvent({
    eventId,
    resourceId,
    resourceType: "deal",
    version,
    eventType: version === 1 ? "create" : "update",
    actorId: "integration-test-user",
    timestamp: `2026-08-22T00:0${version}:00.000Z`,
    state: {
      customer: "Integration Test",
      price: 40000 + version * 1000
    },
    previousStateHash
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tenant = await client.query<{ id: string }>(
      `
      SELECT id
      FROM tenants
      WHERE slug = 'development'
      `
    );

    const tenantId = tenant.rows[0]?.id;

    if (!tenantId) {
      throw new Error("Development tenant not found");
    }

    const resource = await client.query<{ id: string }>(
      `
      INSERT INTO resources (
        tenant_id,
        resource_type,
        external_id
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (tenant_id, resource_type, external_id)
      DO UPDATE SET external_id = EXCLUDED.external_id
      RETURNING id
      `,
      [
        tenantId,
        event.resourceType,
        event.resourceId
      ]
    );

    const resourceIdDb = resource.rows[0].id;

    const versionRow = await client.query<{ id: string }>(
      `
      INSERT INTO resource_versions (
        resource_id,
        version,
        state,
        state_hash,
        previous_state_hash,
        created_by
      )
      VALUES ($1, $2, $3::jsonb, $4, $5, $6)
      RETURNING id
      `,
      [
        resourceIdDb,
        event.version,
        JSON.stringify(event.state),
        event.stateHash,
        event.previousStateHash,
        event.actorId
      ]
    );

    await client.query(
      `
      INSERT INTO evidence_events (
        event_id,
        resource_id,
        version_id,
        event_type,
        actor_id,
        occurred_at,
        state_hash,
        previous_state_hash
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        event.eventId,
        resourceIdDb,
        versionRow.rows[0].id,
        event.eventType,
        event.actorId,
        event.timestamp,
        event.stateHash,
        event.previousStateHash
      ]
    );

    await client.query("COMMIT");

    return event;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

describe("VSL end-to-end anchoring", () => {
  it("creates a real Merkle batch and anchors its root to Fabric", async () => {
    const resourceId = `e2e-deal-${Date.now()}`;

    const v1 = await insertEvidence(
      "00000000-0000-4000-8000-100000000001",
      resourceId,
      1,
      null
    );

    await insertEvidence(
      "00000000-0000-4000-8000-100000000002",
      resourceId,
      2,
      v1.stateHash
    );

    const adapter = await fabricAdapterPromise;
    const service = new MerkleBatchService(pool, adapter);

    const tenantId = await getTestTenantId();

    const batch = await service.createPendingBatch(tenantId, 10);

    expect(batch).not.toBeNull();
    expect(batch?.status).toBe("pending");
    expect(batch?.eventCount).toBe(2);
    expect(batch?.merkleRoot).toHaveLength(64);

    const anchored = await service.anchorBatch(tenantId, batch!.id);

    expect(anchored.status).toBe("anchored");
    expect(anchored.blockchainReference).toBeTruthy();
    expect(anchored.anchoredAt).not.toBeNull();

    const blockchainAnchor = await adapter.getAnchor(batch!.id);

    expect(blockchainAnchor).not.toBeNull();
    expect(blockchainAnchor?.batchId).toBe(batch!.id);
    expect(blockchainAnchor?.merkleRoot).toBe(batch!.merkleRoot);
    expect(blockchainAnchor?.protocolVersion).toBe(
      batch!.protocolVersion
    );

    const stored = await service.getBatch(tenantId, batch!.id);

    expect(stored?.status).toBe("anchored");
    expect(stored?.merkleRoot).toBe(batch!.merkleRoot);
    expect(stored?.blockchainReference).toBe(
      anchored.blockchainReference
    );
  });
});
