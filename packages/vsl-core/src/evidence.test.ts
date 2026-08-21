import { describe, expect, it } from "vitest";
import { createEvidenceEvent } from "./evidence.js";

describe("createEvidenceEvent", () => {
  it("creates a deterministic state commitment", () => {
    const input = {
      eventId: "evt-001",
      resourceId: "deal-001",
      resourceType: "deal",
      version: 1,
      eventType: "create" as const,
      actorId: "user-001",
      timestamp: "2026-08-22T00:00:00.000Z",
      state: {
        price: 35000,
        customer: "Alice"
      },
      previousStateHash: null
    };

    const event = createEvidenceEvent(input);

    expect(event.version).toBe(1);
    expect(event.previousStateHash).toBeNull();
    expect(event.stateHash).toHaveLength(64);
  });

  it("links a new version to the previous state hash", () => {
    const v1 = createEvidenceEvent({
      eventId: "evt-001",
      resourceId: "deal-001",
      resourceType: "deal",
      version: 1,
      eventType: "create" as const,
      actorId: "user-001",
      timestamp: "2026-08-22T00:00:00.000Z",
      state: {
        price: 35000
      },
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
      state: {
        price: 42000
      },
      previousStateHash: v1.stateHash
    });

    expect(v2.previousStateHash).toBe(v1.stateHash);
    expect(v2.stateHash).not.toBe(v1.stateHash);
  });
});
