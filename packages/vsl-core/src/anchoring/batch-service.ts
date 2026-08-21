import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { EvidenceEvent, AnchorBatch } from "@vsl/shared";
import { createMerkleBatch } from "@vsl/merkle";

interface EventRow {
  event_id: string;
  resource_type: string;
  resource_external_id: string;
  version: number;
  event_type: EvidenceEvent["eventType"];
  actor_id: string;
  occurred_at: Date;
  state: unknown;
  state_hash: string;
  previous_state_hash: string | null;
}

export class MerkleBatchService {
  constructor(private readonly pool: Pool) {}

  async createPendingBatch(
    batchSize = 100
  ): Promise<AnchorBatch | null> {
    if (!Number.isInteger(batchSize) || batchSize <= 0) {
      throw new Error("batchSize must be a positive integer");
    }

    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const events = await this.claimEvents(client, batchSize);

      if (events.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }

      const evidenceEvents = events.map((row) =>
        this.toEvidenceEvent(row)
      );

      const batch = createMerkleBatch(evidenceEvents, "v1");

      const batchId = randomUUID();

      const inserted = await client.query<{
        id: string;
        merkle_root: string;
        protocol_version: string;
        status: AnchorBatch["status"];
        blockchain_reference: string | null;
        event_count: number;
        created_at: Date;
        anchored_at: Date | null;
      }>(
        `
        INSERT INTO anchor_batches (
          id,
          merkle_root,
          protocol_version,
          status,
          blockchain_reference,
          event_count
        )
        VALUES ($1, $2, $3, 'pending', NULL, $4)
        RETURNING
          id,
          merkle_root,
          protocol_version,
          status,
          blockchain_reference,
          event_count,
          created_at,
          anchored_at
        `,
        [
          batchId,
          batch.merkleRoot,
          batch.protocolVersion,
          batch.eventIds.length
        ]
      );

      await client.query(
        `
        UPDATE evidence_events
        SET anchor_batch_id = $1
        WHERE event_id = ANY($2::uuid[])
        `,
        [batchId, batch.eventIds]
      );

      await client.query("COMMIT");

      return this.toAnchorBatch(inserted.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async claimEvents(
    client: PoolClient,
    batchSize: number
  ): Promise<EventRow[]> {
    const result = await client.query<EventRow>(
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
      WHERE ee.anchor_batch_id IS NULL
      ORDER BY
        r.resource_type ASC,
        r.external_id ASC,
        rv.version ASC,
        ee.event_id ASC
      LIMIT $1
      FOR UPDATE OF ee SKIP LOCKED
      `,
      [batchSize]
    );

    return result.rows;
  }

  private toEvidenceEvent(row: EventRow): EvidenceEvent {
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

  private toAnchorBatch(row: {
    id: string;
    merkle_root: string;
    protocol_version: string;
    status: AnchorBatch["status"];
    blockchain_reference: string | null;
    event_count: number;
    created_at: Date;
    anchored_at: Date | null;
  }): AnchorBatch {
    return {
      id: row.id,
      merkleRoot: row.merkle_root,
      protocolVersion: row.protocol_version,
      status: row.status,
      blockchainReference: row.blockchain_reference,
      eventCount: row.event_count,
      createdAt: row.created_at.toISOString(),
      anchoredAt: row.anchored_at?.toISOString() ?? null
    };
  }
}
