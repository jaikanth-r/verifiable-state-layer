import { MerkleBatchService } from "@vsl/vsl-core";
import { MerkleVerifier } from "@vsl/vsl-core";
import { pool } from "../config/database.js";

export const batchService = new MerkleBatchService(pool);
export const merkleVerifier = new MerkleVerifier(pool);
