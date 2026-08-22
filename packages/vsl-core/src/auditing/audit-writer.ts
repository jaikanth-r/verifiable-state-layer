import type { PoolClient } from "pg";

export interface AuditWrite {
  tenantId?: string | null;
  userId?: string | null;
  action: string;
  outcome: "success" | "failure" | "denied";
  resourceId?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AuditWriter {
  write(
    event: AuditWrite,
    client?: PoolClient
  ): Promise<void>;
}
