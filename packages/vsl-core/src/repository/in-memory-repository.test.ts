import { describe, expect, it } from "vitest";
import { createEvidenceEvent } from "../evidence.js";
import { InMemoryEvidenceRepository } from "./in-memory-repository.js";

describe("InMemoryEvidenceRepository", () => {
  it("stores a valid version chain", () => {
    const repository = new InMemoryEvidenceRepository();

    const v1 = createEvidenceEvent({
      eventId: "evt-001",
      resourceId: "deal-001",
      resourceType: "deal",
      version: 1,
      eventType: "create" as const,
      actorId: "user-001",
      timestamp: "2026-08-22T00:00:00.000Z",
      state: { price: 35000 },
      previousStateHash: null
    });

    const v2 = createEvidenceEvent({
      eventId: "evt-002",
      resourceId: "deal-001",
      resourceType: "deal",
      version: 2,
      eventType: "update" as const,
      actorId: "user-001",
      timestamp: "2026-08-22T00:01:00.000Z",
      state: { price: 42000 },
      previousStateHash: v1.stateHash
    });

    repository.save(v1);
    repository.save(v2);

    expect(repository.getHistory("deal-001")).toHaveLength(2);
    expect(repository.getVersion("deal-001", 2)?.state).toEqual({
      price: 42000
    });
  });

  it("rejects a version gap", () => {
    const repository = new InMemoryEvidenceRepository();

    const v1 = createEvidenceEvent({
      eventId: "evt-001",
      resourceId: "deal-001",
      resourceType: "deal",
      version: 1,
      eventType: "create" as const,
      actorId: "user-001",
      timestamp: "2026-08-22T00:00:00.000Z",
      state: { price: 35000 },
      previousStateHash: null
    });

    const v3 = createEvidenceEvent({
      eventId: "evt-003",
      resourceId: "deal-001",
      resourceType: "deal",
      version: 3,
      eventType: "update" as const,
      actorId: "user-001",
      timestamp: "2026-08-22T00:02:00.000Z",
      state: { price: 50000 },
      previousStateHash: v1.stateHash
    });

    repository.save(v1);

    expect(() => repository.save(v3)).toThrow(
      "Invalid version sequence"
    );
  });

  it("rejects an incorrect previous state hash", () => {
    const repository = new InMemoryEvidenceRepository();

    const v1 = createEvidenceEvent({
      eventId: "evt-001",
      resourceId: "deal-001",
      resourceType: "deal",
      version: 1,
      eventType: "create" as const,
      actorId: "user-001",
      timestamp: "2026-08-22T00:00:00.000Z",
      state: { price: 35000 },
      previousStateHash: null
    });

    const v2 = createEvidenceEvent({
      eventId: "evt-002",
      resourceId: "deal-001",
      resourceType: "deal",
      version: 2,
      eventType: "update" as const,
      actorId: "user-001",
      timestamp: "2026-08-22T00:01:00.000Z",
      state: { price: 42000 },
      previousStateHash: "wrong-hash"
    });

    repository.save(v1);

    expect(() => repository.save(v2)).toThrow(
      "Previous state hash"
    );
  });

  it("rejects duplicate versions", () => {
    const repository = new InMemoryEvidenceRepository();

    const v1 = createEvidenceEvent({
      eventId: "evt-001",
      resourceId: "deal-001",
      resourceType: "deal",
      version: 1,
      eventType: "create" as const,
      actorId: "user-001",
      timestamp: "2026-08-22T00:00:00.000Z",
      state: { price: 35000 },
      previousStateHash: null
    });

    repository.save(v1);

    expect(() => repository.save(v1)).toThrow(
      "already exists"
    );
  });
});
