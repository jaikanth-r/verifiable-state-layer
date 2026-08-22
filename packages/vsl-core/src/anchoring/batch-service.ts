import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";

import type { EvidenceEvent, AnchorBatch } from "@vsl/shared";
import { createMerkleBatch } from "@vsl/merkle";
import type { AnchorAdapter } from "../blockchain/anchor-adapter.js";
import type { AuditWriter } from "../auditing/audit-writer.js";

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

interface AnchorBatchRow {
  id: string;
  merkle_root: string;
  protocol_version: string;
  status: AnchorBatch["status"];
  blockchain_reference: string | null;
  event_count: number;
  created_at: Date;
  anchored_at: Date | null;
}

export class MerkleBatchService {
  constructor(
    private readonly pool: Pool,
    private readonly anchorAdapter?: AnchorAdapter,
    private readonly auditWriter?: AuditWriter
  ) {}

  async createPendingBatch(
    tenantId: string,
    batchSize = 100,
    userId?: string,
    requestId?: string
  ): Promise<AnchorBatch | null> {
    if (!Number.isInteger(batchSize) || batchSize <= 0) {
      throw new Error("batchSize must be a positive integer");
    }

    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const events = await this.claimEvents(client, tenantId, batchSize);

      if (events.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }

      const evidenceEvents = events.map((row) =>
        this.toEvidenceEvent(row)
      );

      const batch = createMerkleBatch(evidenceEvents, "v1");
      const batchId = randomUUID();

      const inserted = await client.query<AnchorBatchRow>(
        `
        INSERT INTO anchor_batches (
          id,
          tenant_id,
          merkle_root,
          protocol_version,
          status,
          blockchain_reference,
          event_count
        )
        VALUES ($1, $2, $3, $4, 'pending', NULL, $5)
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
          tenantId,
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

      await this.auditWriter?.write(
        {
          tenantId,
	  userId,
          action: "BATCH_CREATED",
          outcome: "success",
          resourceId: batchId,
	  requestId,
          metadata: {
            merkleRoot: batch.merkleRoot,
            protocolVersion: batch.protocolVersion,
            eventCount: batch.eventIds.length
          }
        },
        client
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

  async anchorBatch(
    tenantId: string,
    batchId: string,
    userId?: string,
    requestId?: string
  ): Promise<AnchorBatch> {
    if (!this.anchorAdapter) {
      throw new Error("AnchorAdapter is not configured");
    }

    const batch = await this.getBatch(tenantId, batchId);

    if (!batch) {
      throw new Error(`Anchor batch not found: ${batchId}`);
    }

    if (batch.status === "anchored") {
      return batch;
    }

    if (batch.status !== "pending" && batch.status !== "failed") {
      throw new Error(
        `Batch ${batchId} cannot be anchored from status ${batch.status}`
      );
    }

    await this.setStatus(tenantId, batchId, "submitted");

    try {
      const anchor = await this.anchorAdapter.anchor({
        batchId: batch.id,
        merkleRoot: batch.merkleRoot,
        protocolVersion: batch.protocolVersion
      });

      const client = await this.pool.connect();

      try {
        await client.query("BEGIN");

        const result = await client.query<AnchorBatchRow>(
          `
          UPDATE anchor_batches
          SET
            status = 'anchored',
            blockchain_reference = $2,
            anchored_at = $3
          WHERE id = $1
            AND tenant_id = $4
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
            anchor.transactionId ?? anchor.anchoredAt,
            anchor.anchoredAt,
              tenantId
          ]
        );

        await client.query("COMMIT");

        await this.auditWriter?.write({
          tenantId,
	  userId,
          action: "BATCH_ANCHORED",
          outcome: "success",
          resourceId: batchId,
	  requestId,
          metadata: {
            merkleRoot: batch.merkleRoot,
            protocolVersion: batch.protocolVersion,
            transactionId: anchor.transactionId ?? null,
            anchoredAt: anchor.anchoredAt
          }
        });

        return this.toAnchorBatch(result.rows[0]);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      await this.setStatus(tenantId, batchId, "failed");

      await this.auditWriter?.write({
        tenantId,
	userId,
        action: "BATCH_ANCHOR_FAILED",
        outcome: "failure",
        resourceId: batchId,
	requestId,
        metadata: {
          error:
            error instanceof Error
              ? error.message
              : String(error)
        }
      });

      throw error;
    }
  }

  async getBatch(
    tenantId: string,
    batchId: string
  ): Promise<AnchorBatch | null> {
    const result = await this.pool.query<AnchorBatchRow>(
      `
      SELECT
        id,
        merkle_root,
        protocol_version,
        status,
        blockchain_reference,
        event_count,
        created_at,
        anchored_at
      FROM anchor_batches
      WHERE id = $1
        AND tenant_id = $2
      `,
      [batchId, tenantId]
    );

    return result.rows[0]
      ? this.toAnchorBatch(result.rows[0])
      : null;
  }

  private async setStatus(
    tenantId: string,
    batchId: string,
    status: AnchorBatch["status"]
  ): Promise<void> {
    await this.pool.query(
      `
      UPDATE anchor_batches
      SET status = $3
      WHERE id = $2
        AND tenant_id = $1
      `,
      [tenantId, batchId, status]
    );
  }

  private async claimEvents(
    client: PoolClient,
    tenantId: string,
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
        AND r.tenant_id = $2
      ORDER BY
        r.resource_type ASC,
        r.external_id ASC,
        rv.version ASC,
        ee.event_id ASC
      LIMIT $1
      FOR UPDATE OF ee SKIP LOCKED
      `,
      [batchSize, tenantId]
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

  private toAnchorBatch(row: AnchorBatchRow): AnchorBatch {
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
