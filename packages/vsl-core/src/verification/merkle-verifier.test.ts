import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { createEvidenceEvent } from "../evidence.js";
import { MerkleBatchService } from "../anchoring/batch-service.js";
import { MerkleVerifier } from "./merkle-verifier.js";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://vsl:vsl_dev_password@127.0.0.1:5432/vsl"
});

const batchService = new MerkleBatchService(pool);
const verifier = new MerkleVerifier(pool);

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
  await pool.end();
});

async function seedEvent(
  eventId: string,
  version: number,
  previousStateHash: string | null
) {
  const event = createEvidenceEvent({
    eventId,
    resourceId: "deal-verify",
    resourceType: "deal",
    version,
    eventType: version === 1 ? "create" : "update",
    actorId: "user-001",
    timestamp: `2026-08-22T00:0${version}:00.000Z`,
    state: {
      customer: "Alice",
      price: 30000 + version * 1000
    },
    previousStateHash
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const resource = await client.query<{ id: string }>(
      `
      INSERT INTO resources (resource_type, external_id)
      VALUES ($1, $2)
      ON CONFLICT (resource_type, external_id)
      DO UPDATE SET external_id = EXCLUDED.external_id
      RETURNING id
      `,
      [event.resourceType, event.resourceId]
    );

    const resourceId = resource.rows[0].id;

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
        resourceId,
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
        resourceId,
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

describe("MerkleVerifier", () => {
  it("verifies an anchored event", async () => {
    const v1 = await seedEvent(
      "00000000-0000-4000-8000-000000000101",
      1,
      null
    );

    const v2 = await seedEvent(
      "00000000-0000-4000-8000-000000000102",
      2,
      v1.stateHash
    );

    const batch = await batchService.createPendingBatch();

    expect(batch).not.toBeNull();

    const result = await verifier.verifyEvent(v2.eventId);

    expect(result.valid).toBe(true);
    expect(result.eventId).toBe(v2.eventId);
    expect(result.batchId).toBe(batch?.id);
    expect(result.merkleRoot).toBe(batch?.merkleRoot);
    expect(result.proof).not.toBeNull();
  });

  it("rejects an unknown event", async () => {
    const result = await verifier.verifyEvent(
      "00000000-0000-4000-8000-000000009999"
    );

    expect(result.valid).toBe(false);
    expect(result.proof).toBeNull();
  });

  it("detects a modified stored event hash", async () => {
    const v1 = await seedEvent(
      "00000000-0000-4000-8000-000000000201",
      1,
      null
    );

    await batchService.createPendingBatch();

    await pool.query(
      `
      UPDATE evidence_events
      SET state_hash = encode(
        digest('tampered', 'sha256'),
        'hex'
      )
      WHERE event_id = $1
      `,
      [v1.eventId]
    );

    const result = await verifier.verifyEvent(v1.eventId);

    expect(result.valid).toBe(false);
  });
});
