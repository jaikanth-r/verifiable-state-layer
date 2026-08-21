import type { EvidenceEvent } from "@vsl/shared";

export interface EvidenceRepository {
  save<T>(event: EvidenceEvent<T>): Promise<void> | void;

  getVersion<T>(
    resourceType: string,
    resourceId: string,
    version: number
  ): Promise<EvidenceEvent<T> | undefined> | EvidenceEvent<T> | undefined;

  getHistory<T>(
    resourceType: string,
    resourceId: string
  ): Promise<EvidenceEvent<T>[]> | EvidenceEvent<T>[];
}
