import type { EvidenceEvent, EventType } from "@vsl/shared";
import { sha256 } from "@vsl/crypto";

export interface CreateEvidenceEventInput<T> {
  eventId: string;
  resourceId: string;
  resourceType: string;
  version: number;
  eventType: EventType;
  actorId: string;
  timestamp: string;
  state: T;
  previousStateHash: string | null;
}

export function createEvidenceEvent<T>(
  input: CreateEvidenceEventInput<T>
): EvidenceEvent<T> {
  const stateHash = sha256({
    resourceId: input.resourceId,
    resourceType: input.resourceType,
    version: input.version,
    state: input.state,
    previousStateHash: input.previousStateHash
  });

  return {
    ...input,
    stateHash
  };
}
