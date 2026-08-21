import { z } from "zod";

export const EventTypeSchema = z.enum([
  "create",
  "update",
  "approve",
  "amend",
  "complete",
  "revoke"
]);

export type EventType = z.infer<typeof EventTypeSchema>;

export interface ResourceVersion<T = unknown> {
  resourceId: string;
  resourceType: string;
  version: number;
  state: T;
  previousStateHash: string | null;
}

export interface EvidenceEvent<T = unknown> {
  eventId: string;
  resourceId: string;
  resourceType: string;
  version: number;
  eventType: EventType;
  actorId: string;
  timestamp: string;
  state: T;
  previousStateHash: string | null;
  stateHash: string;
}
