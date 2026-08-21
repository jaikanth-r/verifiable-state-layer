import type { Pool } from "pg";
import {
  createMerkleProof,
  verifyMerkleProof,
  type MerkleProof
} from "@vsl/merkle";

export interface VerificationResult {
  valid: boolean;
  eventId: string;
  batchId: string;
  merkleRoot: string;
  proof: MerkleProof | null;
}

export class MerkleVerifier {
  constructor(private readonly pool: Pool) {}

  async verifyEvent(eventId: string): Promise<VerificationResult> {
    const result = await this.pool.query<{
      event_id: string;
      anchor_batch_id: string;
      merkle_root: string;
    }>(
      `
      SELECT
        ee.event_id,
        ee.anchor_batch_id,
        ab.merkle_root
      FROM evidence_events ee
      JOIN anchor_batches ab
        ON ab.id = ee.anchor_batch_id
      WHERE ee.event_id = $1
      `,
      [eventId]
    );

    const row = result.rows[0];

    if (!row || !row.anchor_batch_id) {
      return {
        valid: false,
        eventId,
        batchId: "",
        merkleRoot: "",
        proof: null
      };
    }

    const events = await this.pool.query<{
      event_id: string;
      resource_type: string;
      resource_id: string;
      version: number;
      state_hash: string;
    }>(
      `
      SELECT
        ee.event_id,
        r.resource_type,
        r.external_id AS resource_id,
        rv.version,
        ee.state_hash
      FROM evidence_events ee
      JOIN resources r
        ON r.id = ee.resource_id
      JOIN resource_versions rv
        ON rv.id = ee.version_id
      WHERE ee.anchor_batch_id = $1
      ORDER BY
        r.resource_type ASC,
        r.external_id ASC,
        rv.version ASC,
        ee.event_id ASC
      `,
      [row.anchor_batch_id]
    );

    const leaves = events.rows.map((event) => event.state_hash);
    const targetIndex = events.rows.findIndex(
      (event) => event.event_id === eventId
    );

    if (targetIndex === -1) {
      return {
        valid: false,
        eventId,
        batchId: row.anchor_batch_id,
        merkleRoot: row.merkle_root,
        proof: null
      };
    }

    const proof = createMerkleProof(leaves, targetIndex);

    const valid =
      proof.root === row.merkle_root &&
      verifyMerkleProof(proof);

    return {
      valid,
      eventId,
      batchId: row.anchor_batch_id,
      merkleRoot: row.merkle_root,
      proof
    };
  }
}
