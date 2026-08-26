import type { Pool } from "pg";
import { sha256 } from "@vsl/crypto";
import {
  createMerkleProof,
  verifyMerkleProof,
  type MerkleProof
} from "@vsl/merkle";

export type VerificationReason =
  | "VALID"
  | "EVENT_NOT_FOUND"
  | "NOT_ANCHORED"
  | "STATE_TAMPERED"
  | "ANCHOR_MISMATCH";

export interface VerificationResult {
  valid: boolean;
  reason: VerificationReason;
  eventId: string;
  batchId: string;
  merkleRoot: string;
  proof: MerkleProof | null;
}

export class MerkleVerifier {
  constructor(private readonly pool: Pool) {}

  async verifyEvent(
    tenantId: string,
    eventId: string
  ): Promise<VerificationResult> {
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
      JOIN resources r
        ON r.id = ee.resource_id
      LEFT JOIN anchor_batches ab
        ON ab.id = ee.anchor_batch_id
      WHERE ee.event_id = $1
        AND r.tenant_id = $2
      `,
      [eventId, tenantId]
    );

    const row = result.rows[0];

    if (!row) {
      return {
        valid: false,
        reason: "EVENT_NOT_FOUND",
        eventId,
        batchId: "",
        merkleRoot: "",
        proof: null
      };
    }

    if (!row.anchor_batch_id) {
      return {
        valid: false,
        reason: "NOT_ANCHORED",
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
      state: unknown;
      resource_version_state_hash: string;
      resource_version_previous_state_hash: string | null;
      state_hash: string;
      previous_state_hash: string | null;
    }>(
      `
      SELECT
        ee.event_id,
        r.resource_type,
        r.external_id AS resource_id,
        rv.version,
        rv.state,
        rv.state_hash AS resource_version_state_hash,
        rv.previous_state_hash AS resource_version_previous_state_hash,
        ee.state_hash,
        ee.previous_state_hash
      FROM evidence_events ee
      JOIN resources r
        ON r.id = ee.resource_id
      JOIN resource_versions rv
        ON rv.id = ee.version_id
      JOIN anchor_batches ab
        ON ab.id = ee.anchor_batch_id
      WHERE ee.anchor_batch_id = $1
        AND r.tenant_id = $2
        AND ab.tenant_id = $2
      ORDER BY
        r.resource_type ASC,
        r.external_id ASC,
        rv.version ASC,
        ee.event_id ASC
      `,
      [row.anchor_batch_id, tenantId]
    );

    const integrityChecks = events.rows.map((event) => {
      const hashCopiesMatch =
        event.resource_version_state_hash === event.state_hash &&
        event.resource_version_previous_state_hash ===
          event.previous_state_hash;

      const recomputedStateHash = sha256({
        resourceId: event.resource_id,
        resourceType: event.resource_type,
        version: event.version,
        state: event.state,
        previousStateHash: event.previous_state_hash
      });

      return {
        eventId: event.event_id,
        hashCopiesMatch,
        storedStateHash: event.state_hash,
        recomputedStateHash
      };
    });

    const hasIntegrityMismatch = integrityChecks.some(
      (check) =>
        !check.hashCopiesMatch ||
        check.storedStateHash !== check.recomputedStateHash
    );

    const leaves = events.rows.map((event) => event.state_hash);
    const targetIndex = events.rows.findIndex(
      (event) => event.event_id === eventId
    );

    if (targetIndex === -1) {
      return {
        valid: false,
        reason: "EVENT_NOT_FOUND",
        eventId,
        batchId: row.anchor_batch_id,
        merkleRoot: row.merkle_root,
        proof: null
      };
    }

    const proof = createMerkleProof(leaves, targetIndex);

    const anchorMatches =
      proof.root === row.merkle_root &&
      verifyMerkleProof(proof);

    let reason: VerificationReason = "VALID";

    if (hasIntegrityMismatch) {
      reason = "STATE_TAMPERED";
    } else if (!anchorMatches) {
      reason = "ANCHOR_MISMATCH";
    }

    return {
      valid: reason === "VALID",
      reason,
      eventId,
      batchId: row.anchor_batch_id,
      merkleRoot: row.merkle_root,
      proof
    };
  }
}
