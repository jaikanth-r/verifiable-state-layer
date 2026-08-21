import { describe, expect, it } from "vitest";
import { createMerkleBatch } from "./batcher.js";
import type { EvidenceEvent } from "@vsl/shared";

function event(
  eventId: string,
  resourceId: string,
  version: number,
  stateHash: string
): EvidenceEvent {
  return {
    eventId,
    resourceId,
    resourceType: "deal",
    version,
    eventType: "update",
    actorId: "user-001",
    timestamp: "2026-08-22T00:00:00.000Z",
    state: {},
    previousStateHash: null,
    stateHash
  };
}

describe("createMerkleBatch", () => {
  it("creates a batch with canonical ordering", () => {
    const result = createMerkleBatch([
      event("evt-003", "deal-001", 3, "hash-003"),
      event("evt-001", "deal-001", 1, "hash-001"),
      event("evt-002", "deal-001", 2, "hash-002")
    ]);

    expect(result.eventIds).toEqual([
      "evt-001",
      "evt-002",
      "evt-003"
    ]);

    expect(result.stateHashes).toEqual([
      "hash-001",
      "hash-002",
      "hash-003"
    ]);

    expect(result.merkleRoot).toHaveLength(64);
    expect(result.protocolVersion).toBe("v1");
  });

  it("is independent of input order", () => {
    const a = createMerkleBatch([
      event("evt-001", "deal-001", 1, "hash-001"),
      event("evt-002", "deal-001", 2, "hash-002")
    ]);

    const b = createMerkleBatch([
      event("evt-002", "deal-001", 2, "hash-002"),
      event("evt-001", "deal-001", 1, "hash-001")
    ]);

    expect(a.merkleRoot).toBe(b.merkleRoot);
  });

  it("orders resources before event IDs", () => {
    const result = createMerkleBatch([
      event("evt-002", "deal-002", 1, "hash-002"),
      event("evt-001", "deal-001", 1, "hash-001")
    ]);

    expect(result.eventIds).toEqual([
      "evt-001",
      "evt-002"
    ]);
  });

  it("rejects empty batches", () => {
    expect(() => createMerkleBatch([])).toThrow(
      "Cannot create an empty Merkle batch"
    );
  });
});
