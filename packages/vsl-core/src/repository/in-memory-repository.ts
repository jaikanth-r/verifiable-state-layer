import type { EvidenceEvent } from "@vsl/shared";

import type { EvidenceRepository } from "./evidence-repository.js";

export class InMemoryEvidenceRepository implements EvidenceRepository {
  private readonly events = new Map<string, EvidenceEvent[]>();

  private key(
    tenantId: string,
    resourceType: string,
    resourceId: string
  ): string {
    return `${tenantId}:${resourceType}:${resourceId}`;
  }

  save<T>(tenantId: string, event: EvidenceEvent<T>): void {
    const key = this.key(
      tenantId,
      event.resourceType,
      event.resourceId
    );

    const history = this.events.get(key) ?? [];

    if (history.some((existing) => existing.version === event.version)) {
      throw new Error(
        `Version ${event.version} already exists for resource ${event.resourceId}`
      );
    }

    const latest = history.at(-1);

    if (!latest && event.version !== 1) {
      throw new Error(
        `First version for resource ${event.resourceId} must be version 1`
      );
    }

    if (latest) {
      if (event.version !== latest.version + 1) {
        throw new Error(
          `Invalid version sequence for resource ${event.resourceId}`
        );
      }

      if (event.previousStateHash !== latest.stateHash) {
        throw new Error(
          `Previous state hash does not match version ${latest.version}`
        );
      }
    } else if (event.previousStateHash !== null) {
      throw new Error(
        "Version 1 must not reference a previous state hash"
      );
    }

    history.push(event);
    this.events.set(key, history);
  }

  getVersion<T>(
    tenantId: string,
    resourceType: string,
    resourceId: string,
    version: number
  ): EvidenceEvent<T> | undefined {
    return this.events
      .get(this.key(tenantId, resourceType, resourceId))
      ?.find(
        (event) =>
          event.resourceType === resourceType &&
          event.version === version
      ) as EvidenceEvent<T> | undefined;
  }

  getHistory<T>(
    tenantId: string,
    resourceType: string,
    resourceId: string
  ): EvidenceEvent<T>[] {
    return [
      ...(this.events.get(
        this.key(tenantId, resourceType, resourceId)
      ) ?? [])
    ].filter(
      (event) => event.resourceType === resourceType
    ) as EvidenceEvent<T>[];
  }
}
