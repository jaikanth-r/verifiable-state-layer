import type { EvidenceEvent } from "@vsl/shared";
import { buildMerkleRoot } from "./merkle.js";

export interface MerkleBatch {
  merkleRoot: string;
  eventIds: string[];
  stateHashes: string[];
  protocolVersion: string;
}

export function createMerkleBatch(
  events: EvidenceEvent[],
  protocolVersion = "v1"
): MerkleBatch {
  if (events.length === 0) {
    throw new Error("Cannot create an empty Merkle batch");
  }

  const ordered = [...events].sort((a, b) =>
    a.eventId.localeCompare(b.eventId)
  );

  const stateHashes = ordered.map((event) => event.stateHash);

  return {
    merkleRoot: buildMerkleRoot(stateHashes),
    eventIds: ordered.map((event) => event.eventId),
    stateHashes,
    protocolVersion
  };
}
