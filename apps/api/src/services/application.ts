import { MerkleBatchService } from "@vsl/vsl-core";
import { FabricAnchorAdapter } from "@vsl/vsl-core";
import { pool } from "../config/database.js";

const HOME = process.env.HOME!;

const fabricAdapterPromise = FabricAnchorAdapter.connect({
  peerEndpoint: process.env.FABRIC_PEER_ENDPOINT ?? "localhost:7051",
  tlsRootCertPath:
    process.env.FABRIC_TLS_ROOT_CERT ??
    `${HOME}/fabric-samples/test-network/organizations/peerOrganizations/` +
    `org1.example.com/tlsca/tlsca.org1.example.com-cert.pem`,
  mspId: process.env.FABRIC_MSP_ID ?? "Org1MSP",
  identityCertPath:
    process.env.FABRIC_IDENTITY_CERT ??
    `${HOME}/fabric-samples/test-network/organizations/peerOrganizations/` +
    `org1.example.com/users/Admin@org1.example.com/msp/signcerts/` +
    `Admin@org1.example.com-cert.pem`,
  privateKeyPath:
    process.env.FABRIC_PRIVATE_KEY ??
    `${HOME}/fabric-samples/test-network/organizations/peerOrganizations/` +
    `org1.example.com/users/Admin@org1.example.com/msp/keystore/priv_sk`,
  channelName: process.env.FABRIC_CHANNEL ?? "vslchannel",
  chaincodeName: process.env.FABRIC_CHAINCODE ?? "vsl-anchor"
});

export const servicesPromise = fabricAdapterPromise.then(
  (fabricAdapter) => ({
    fabricAdapter,
    batchService: new MerkleBatchService(pool, fabricAdapter)
  })
);

export async function closeServices(): Promise<void> {
  const { fabricAdapter } = await servicesPromise;
  fabricAdapter.close();
  await pool.end();
}
