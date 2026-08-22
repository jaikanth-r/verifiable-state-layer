import type { EvidenceEvent } from "@vsl/shared";

export interface EvidenceRepository {
  save<T>(
    tenantId: string,
    event: EvidenceEvent<T>
  ): Promise<void> | void;

  getVersion<T>(
    tenantId: string,
    resourceType: string,
    resourceId: string,
    version: number
  ): Promise<EvidenceEvent<T> | undefined> | EvidenceEvent<T> | undefined;

  getHistory<T>(
    tenantId: string,
    resourceType: string,
    resourceId: string
  ): Promise<EvidenceEvent<T>[]> | EvidenceEvent<T>[];
}
