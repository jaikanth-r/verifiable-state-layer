export type AnchorBatchStatus =
  | "pending"
  | "submitted"
  | "anchored"
  | "failed";

export interface AnchorBatch {
  id: string;
  merkleRoot: string;
  protocolVersion: string;
  status: AnchorBatchStatus;
  blockchainReference: string | null;
  eventCount: number;
  createdAt: string;
  anchoredAt: string | null;
}
