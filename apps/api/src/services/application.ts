import {
  FabricAnchorAdapter,
  MerkleBatchService
} from "@vsl/vsl-core";

import { pool } from "../config/database.js";
import { PostgresAuditWriter } from "./postgres-audit-writer.js";
import { getFabricRuntimeConfig } from "./fabric-config.js";

const auditWriter = new PostgresAuditWriter();

function fabricEnabled(): boolean {
  const value = process.env.FABRIC_ENABLED;

  if (value === undefined) {
    return true;
  }

  return value.toLowerCase() === "true";
}

const fabricAdapterPromise = fabricEnabled()
  ? FabricAnchorAdapter.connect(getFabricRuntimeConfig())
  : Promise.resolve(null);

export const servicesPromise = fabricAdapterPromise.then(
  (fabricAdapter) => ({
    fabricAdapter,
    batchService: new MerkleBatchService(
      pool,
      fabricAdapter ?? undefined,
      auditWriter
    )
  })
);

export async function closeServices(): Promise<void> {
  const { fabricAdapter } = await servicesPromise;

  fabricAdapter?.close();

  await pool.end();
}
