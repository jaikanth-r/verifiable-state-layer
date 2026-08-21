export interface BlockchainAnchor {
  batchId: string;
  merkleRoot: string;
  protocolVersion: string;
  anchoredAt: string;
  transactionId?: string;
}

export interface AnchorAdapter {
  anchor(batch: {
    batchId: string;
    merkleRoot: string;
    protocolVersion: string;
  }): Promise<BlockchainAnchor>;

  getAnchor(batchId: string): Promise<BlockchainAnchor | null>;
}
