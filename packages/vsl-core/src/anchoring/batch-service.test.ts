import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { createHash } from "node:crypto";
import { createEvidenceEvent } from "../evidence.js";
import { MerkleBatchService } from "./batch-service.js";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://vsl:vsl_dev_password@127.0.0.1:5432/vsl"
});

const service = new MerkleBatchService(pool);

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

function fixtureHash(value: string): string {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

async function insertEvent(
  eventId: string,
  version: number,
  previousStateHash: string | null
) {
  const event = createEvidenceEvent({
    eventId,
    resourceId: "deal-001",
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

describe("MerkleBatchService", () => {
  it("creates a pending batch and links events", async () => {
    const v1 = await insertEvent(
      "00000000-0000-4000-8000-000000000001",
      1,
      null
    );

    await insertEvent(
      "00000000-0000-4000-8000-000000000002",
      2,
      v1.stateHash
    );

    const batch = await service.createPendingBatch();

    expect(batch).not.toBeNull();
    expect(batch?.status).toBe("pending");
    expect(batch?.eventCount).toBe(2);
    expect(batch?.merkleRoot).toHaveLength(64);

    const linked = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM evidence_events
      WHERE anchor_batch_id = $1
      `,
      [batch?.id]
    );

    expect(linked.rows[0].count).toBe(2);
  });

  it("returns null when there are no unbatched events", async () => {
    const batch = await service.createPendingBatch();

    expect(batch).toBeNull();
  });

  it("respects the batch size", async () => {
    let previousHash: string | null = null;

    for (let i = 1; i <= 3; i += 1) {
      const event = await insertEvent(
        `00000000-0000-4000-8000-${i.toString().padStart(12, "0")}`,
        i,
        previousHash
      );

      previousHash = event.stateHash;
    }

    const batch = await service.createPendingBatch(2);

    expect(batch?.eventCount).toBe(2);

    const remaining = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM evidence_events
      WHERE anchor_batch_id IS NULL
      `
    );

    expect(remaining.rows[0].count).toBe(1);
  });

  it("does not double-batch already linked events", async () => {
    await insertEvent(
      "00000000-0000-4000-8000-000000000010",
      1,
      null
    );

    const first = await service.createPendingBatch();
    const second = await service.createPendingBatch();

    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });
});
