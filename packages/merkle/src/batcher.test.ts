import { describe, expect, it } from "vitest";
import { createMerkleBatch } from "./batcher.js";
import type { EvidenceEvent } from "@vsl/shared";

function event(
  eventId: string,
  stateHash: string
): EvidenceEvent {
  return {
    eventId,
    resourceId: "deal-001",
    resourceType: "deal",
    version: Number(eventId.replace("evt-", "")),
    eventType: "update",
    actorId: "user-001",
    timestamp: "2026-08-22T00:00:00.000Z",
    state: {},
    previousStateHash: null,
    stateHash
  };
}

describe("createMerkleBatch", () => {
  it("creates a batch with a Merkle root", () => {
    const result = createMerkleBatch([
      event("evt-002", "hash-002"),
      event("evt-001", "hash-001")
    ]);

    expect(result.eventIds).toEqual([
      "evt-001",
      "evt-002"
    ]);

    expect(result.stateHashes).toEqual([
      "hash-001",
      "hash-002"
    ]);

    expect(result.merkleRoot).toHaveLength(64);
    expect(result.protocolVersion).toBe("v1");
  });

  it("is independent of input order", () => {
    const a = createMerkleBatch([
      event("evt-001", "hash-001"),
      event("evt-002", "hash-002")
    ]);

    const b = createMerkleBatch([
      event("evt-002", "hash-002"),
      event("evt-001", "hash-001")
    ]);

    expect(a.merkleRoot).toBe(b.merkleRoot);
  });

  it("rejects empty batches", () => {
    expect(() => createMerkleBatch([])).toThrow(
      "Cannot create an empty Merkle batch"
    );
  });
});
