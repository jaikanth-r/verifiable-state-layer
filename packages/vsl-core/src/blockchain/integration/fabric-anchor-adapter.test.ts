import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { FabricAnchorAdapter } from "../fabric-anchor-adapter.js";

const HOME = process.env.HOME!;

const adapterPromise = FabricAnchorAdapter.connect({
  peerEndpoint: "localhost:7051",
  tlsRootCertPath:
    `${HOME}/fabric-samples/test-network/organizations/peerOrganizations/` +
    `org1.example.com/tlsca/tlsca.org1.example.com-cert.pem`,
  mspId: "Org1MSP",
  identityCertPath:
    `${HOME}/fabric-samples/test-network/organizations/peerOrganizations/` +
    `org1.example.com/users/Admin@org1.example.com/msp/signcerts/` +
    `Admin@org1.example.com-cert.pem`,
  privateKeyPath:
    `${HOME}/fabric-samples/test-network/organizations/peerOrganizations/` +
    `org1.example.com/users/Admin@org1.example.com/msp/keystore/priv_sk`,
  channelName: "vslchannel",
  chaincodeName: "vsl-anchor",
});

describe("FabricAnchorAdapter", () => {
  afterAll(async () => {
    const adapter = await adapterPromise;
    adapter.close();
  });

  it("anchors and retrieves a batch", async () => {
    const adapter = await adapterPromise;

    const batchId = `integration-${randomUUID()}`;
    const merkleRoot =
      "03d12ebc7cadf81a38c308e8dfa869502cb5dda4cf365b25e3f74b2fe452128d";

    const anchored = await adapter.anchor({
      batchId,
      merkleRoot,
      protocolVersion: "v1"
    });

    expect(anchored.batchId).toBe(batchId);
    expect(anchored.merkleRoot).toBe(merkleRoot);
    expect(anchored.protocolVersion).toBe("v1");

    const retrieved = await adapter.getAnchor(batchId);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.batchId).toBe(batchId);
    expect(retrieved?.merkleRoot).toBe(merkleRoot);
  });
});
