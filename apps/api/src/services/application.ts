import { MerkleBatchService } from "@vsl/vsl-core";
import { FabricAnchorAdapter } from "@vsl/vsl-core";
import { pool } from "../config/database.js";
import { PostgresAuditWriter } from "./postgres-audit-writer.js";
import { getFabricRuntimeConfig } from "./fabric-config.js";

const fabricConfig = getFabricRuntimeConfig();

const fabricAdapterPromise = FabricAnchorAdapter.connect(fabricConfig);

export const servicesPromise = fabricAdapterPromise.then(
  (fabricAdapter) => ({
    fabricAdapter,
    batchService: new MerkleBatchService(pool, fabricAdapter, new PostgresAuditWriter())
  })
);

export async function closeServices(): Promise<void> {
  const { fabricAdapter } = await servicesPromise;
  fabricAdapter.close();
  await pool.end();
}
