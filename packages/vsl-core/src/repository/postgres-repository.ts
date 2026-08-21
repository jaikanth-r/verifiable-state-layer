import { Pool, type PoolClient } from "pg";
import type { EvidenceEvent } from "@vsl/shared";
import type { EvidenceRepository } from "./evidence-repository.js";

interface StoredResource {
  id: string;
}

interface StoredVersion {
  id: string;
  version: number;
  state: unknown;
  state_hash: string;
  previous_state_hash: string | null;
  created_by: string;
  created_at: Date;
}

export class PostgresEvidenceRepository implements EvidenceRepository {
  constructor(private readonly pool: Pool) {}

  async save<T>(event: EvidenceEvent<T>): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const resource = await this.getOrCreateResource(
        client,
        event.resourceType,
        event.resourceId
      );

      const latestResult = await client.query<{
        id: string;
        version: number;
        state_hash: string;
      }>(
        `
        SELECT id, version, state_hash
        FROM resource_versions
        WHERE resource_id = $1
        ORDER BY version DESC
        LIMIT 1
        FOR UPDATE
        `,
        [resource.id]
      );

      const latest = latestResult.rows[0];

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

        if (event.previousStateHash !== latest.state_hash) {
          throw new Error(
            `Previous state hash does not match version ${latest.version}`
          );
        }
      } else if (event.previousStateHash !== null) {
        throw new Error(
          "Version 1 must not reference a previous state hash"
        );
      }

      const insertedVersion = await client.query<StoredVersion>(
        `
        INSERT INTO resource_versions (
          resource_id,
          version,
          state,
          state_hash,
          previous_state_hash,
          created_by
        )
        VALUES ($1, $2, $3::jsonb, $4, $5, $6)
        RETURNING
          id,
          version,
          state,
          state_hash,
          previous_state_hash,
          created_by,
          created_at
        `,
        [
          resource.id,
          event.version,
          JSON.stringify(event.state),
          event.stateHash,
          event.previousStateHash,
          event.actorId
        ]
      );

      const versionRow = insertedVersion.rows[0];

      await client.query(
        `
        INSERT INTO evidence_events (
          event_id,
          resource_id,
          version_id,
          event_type,
          actor_id,
          occurred_at,
          state_hash,
          previous_state_hash,
          signature
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          event.eventId,
          resource.id,
          versionRow.id,
          event.eventType,
          event.actorId,
          event.timestamp,
          event.stateHash,
          event.previousStateHash,
          null
        ]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getVersion<T>(
    resourceType: string,
    resourceId: string,
    version: number
  ): Promise<EvidenceEvent<T> | undefined> {
    const result = await this.pool.query<{
      event_id: string;
      resource_type: string;
      resource_external_id: string;
      version: number;
      event_type: EvidenceEvent["eventType"];
      actor_id: string;
      occurred_at: Date;
      state: T;
      state_hash: string;
      previous_state_hash: string | null;
    }>(
      `
      SELECT
        ee.event_id,
        r.resource_type,
        r.external_id AS resource_external_id,
        rv.version,
        ee.event_type,
        ee.actor_id,
        ee.occurred_at,
        rv.state,
        rv.state_hash,
        rv.previous_state_hash
      FROM evidence_events ee
      JOIN resource_versions rv
        ON rv.id = ee.version_id
      JOIN resources r
        ON r.id = rv.resource_id
      WHERE r.external_id = $1
        AND r.resource_type = $2
        AND rv.version = $3
      LIMIT 1
      `,
      [resourceId, resourceType, version]
    );

    const row = result.rows[0];

    if (!row) {
      return undefined;
    }

    return this.toEvidenceEvent(row);
  }

  async getHistory<T>(
    resourceType: string,
    resourceId: string
  ): Promise<EvidenceEvent<T>[]> {
    const result = await this.pool.query<{
      event_id: string;
      resource_type: string;
      resource_external_id: string;
      version: number;
      event_type: EvidenceEvent["eventType"];
      actor_id: string;
      occurred_at: Date;
      state: T;
      state_hash: string;
      previous_state_hash: string | null;
    }>(
      `
      SELECT
        ee.event_id,
        r.resource_type,
        r.external_id AS resource_external_id,
        rv.version,
        ee.event_type,
        ee.actor_id,
        ee.occurred_at,
        rv.state,
        rv.state_hash,
        rv.previous_state_hash
      FROM evidence_events ee
      JOIN resource_versions rv
        ON rv.id = ee.version_id
      JOIN resources r
        ON r.id = rv.resource_id
      WHERE r.external_id = $1
        AND r.resource_type = $2
      ORDER BY rv.version ASC
      `,
      [resourceId, resourceType]
    );

    return result.rows.map((row) => this.toEvidenceEvent(row));
  }

  private async getOrCreateResource(
    client: PoolClient,
    resourceType: string,
    externalId: string
  ): Promise<StoredResource> {
    const result = await client.query<StoredResource>(
      `
      INSERT INTO resources (resource_type, external_id)
      VALUES ($1, $2)
      ON CONFLICT (resource_type, external_id)
      DO UPDATE SET resource_type = EXCLUDED.resource_type
      RETURNING id
      `,
      [resourceType, externalId]
    );

    return result.rows[0];
  }

  private toEvidenceEvent<T>(row: {
    event_id: string;
    resource_type: string;
    resource_external_id: string;
    version: number;
    event_type: EvidenceEvent["eventType"];
    actor_id: string;
    occurred_at: Date;
    state: T;
    state_hash: string;
    previous_state_hash: string | null;
  }): EvidenceEvent<T> {
    return {
      eventId: row.event_id,
      resourceId: row.resource_external_id,
      resourceType: row.resource_type,
      version: row.version,
      eventType: row.event_type,
      actorId: row.actor_id,
      timestamp: row.occurred_at.toISOString(),
      state: row.state,
      previousStateHash: row.previous_state_hash,
      stateHash: row.state_hash
    };
  }
}
