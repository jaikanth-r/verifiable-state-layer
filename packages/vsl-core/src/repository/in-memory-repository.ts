import type { EvidenceEvent } from "@vsl/shared";

export class InMemoryEvidenceRepository {
  private readonly events = new Map<string, EvidenceEvent[]>();

  save<T>(event: EvidenceEvent<T>): void {
    const history = this.events.get(event.resourceId) ?? [];

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
    this.events.set(event.resourceId, history);
  }

  getVersion<T>(
    resourceId: string,
    version: number
  ): EvidenceEvent<T> | undefined {
    return this.events
      .get(resourceId)
      ?.find((event) => event.version === version) as
      | EvidenceEvent<T>
      | undefined;
  }

  getHistory<T>(resourceId: string): EvidenceEvent<T>[] {
    return [...(this.events.get(resourceId) ?? [])] as EvidenceEvent<T>[];
  }
}
