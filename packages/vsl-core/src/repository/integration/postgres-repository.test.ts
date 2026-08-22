import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { createEvidenceEvent } from "../../evidence.js";
import { PostgresEvidenceRepository } from "../postgres-repository.js";

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://vsl:vsl_dev_password@127.0.0.1:5432/vsl_test";

const pool = new Pool({
  connectionString: DATABASE_URL
});

const repository = new PostgresEvidenceRepository(pool);

let TEST_TENANT_ID: string;

beforeEach(async () => {
  const tenant = await pool.query<{ id: string }>(
    `
    SELECT id
    FROM tenants
    WHERE slug = 'development'
    `
  );

  TEST_TENANT_ID = tenant.rows[0]?.id ?? "";

  if (!TEST_TENANT_ID) {
    throw new Error("Development tenant not found");
  }

  await pool.query(`
    TRUNCATE
      evidence_events,
      resource_versions,
      resources
    RESTART IDENTITY CASCADE
  `);
});

afterAll(async () => {
  await pool.end();
});

function createV1() {
  return createEvidenceEvent({
    eventId: crypto.randomUUID(),
    resourceId: "deal-001",
    resourceType: "deal",
    version: 1,
    eventType: "create" as const,
    actorId: "user-001",
    timestamp: "2026-08-22T00:00:00.000Z",
    state: {
      customer: "Alice",
      price: 35000
    },
    previousStateHash: null
  });
}

function createV2(previousStateHash: string) {
  return createEvidenceEvent({
    eventId: crypto.randomUUID(),
    resourceId: "deal-001",
    resourceType: "deal",
    version: 2,
    eventType: "update" as const,
    actorId: "user-001",
    timestamp: "2026-08-22T00:01:00.000Z",
    state: {
      customer: "Alice",
      price: 42000
    },
    previousStateHash
  });
}

describe("PostgresEvidenceRepository", () => {
  it("persists and retrieves a version chain", async () => {
    const v1 = createV1();
    const v2 = createV2(v1.stateHash);

    await repository.save(TEST_TENANT_ID, v1);
    await repository.save(TEST_TENANT_ID, v2);

    const history = await repository.getHistory(TEST_TENANT_ID, "deal", "deal-001");

    expect(history).toHaveLength(2);
    expect(history[0].version).toBe(1);
    expect(history[1].version).toBe(2);
    expect(history[1].previousStateHash).toBe(v1.stateHash);
  });

  it("retrieves a specific version", async () => {
    const v1 = createV1();

    await repository.save(TEST_TENANT_ID, v1);

    const result = await repository.getVersion(
      TEST_TENANT_ID,
      "deal",
      "deal-001",
      1
    );

    expect(result?.state).toEqual({
      customer: "Alice",
      price: 35000
    });
  });

  it("rejects a version gap", async () => {
    const v1 = createV1();

    const v3 = createEvidenceEvent({
      eventId: crypto.randomUUID(),
      resourceId: "deal-001",
      resourceType: "deal",
      version: 3,
      eventType: "update" as const,
      actorId: "user-001",
      timestamp: "2026-08-22T00:02:00.000Z",
      state: {
        customer: "Alice",
        price: 50000
      },
      previousStateHash: v1.stateHash
    });

    await repository.save(TEST_TENANT_ID, v1);

    await expect(repository.save(TEST_TENANT_ID, v3)).rejects.toThrow(
      "Invalid version sequence"
    );
  });

  it("rejects an incorrect predecessor hash", async () => {
    const v1 = createV1();

    const v2 = createV2("wrong-hash");

    await repository.save(TEST_TENANT_ID, v1);

    await expect(repository.save(TEST_TENANT_ID, v2)).rejects.toThrow(
      "Previous state hash"
    );
  });
});
