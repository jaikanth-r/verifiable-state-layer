import { afterEach, describe, expect, it } from "vitest";

import { getFabricRuntimeConfig } from "./fabric-config.js";

describe("getFabricRuntimeConfig", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalValues = {
    FABRIC_PEER_ENDPOINT: process.env.FABRIC_PEER_ENDPOINT,
    FABRIC_TLS_ROOT_CERT: process.env.FABRIC_TLS_ROOT_CERT,
    FABRIC_MSP_ID: process.env.FABRIC_MSP_ID,
    FABRIC_IDENTITY_CERT: process.env.FABRIC_IDENTITY_CERT,
    FABRIC_PRIVATE_KEY: process.env.FABRIC_PRIVATE_KEY,
    FABRIC_CHANNEL: process.env.FABRIC_CHANNEL,
    FABRIC_CHAINCODE: process.env.FABRIC_CHAINCODE
  };

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    for (const [name, value] of Object.entries(originalValues)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });

  it("requires all Fabric settings in production", () => {
    process.env.NODE_ENV = "production";

    delete process.env.FABRIC_PEER_ENDPOINT;
    delete process.env.FABRIC_TLS_ROOT_CERT;
    delete process.env.FABRIC_MSP_ID;
    delete process.env.FABRIC_IDENTITY_CERT;
    delete process.env.FABRIC_PRIVATE_KEY;
    delete process.env.FABRIC_CHANNEL;
    delete process.env.FABRIC_CHAINCODE;

    expect(() => getFabricRuntimeConfig()).toThrow(
      "FABRIC_PEER_ENDPOINT is required when NODE_ENV=production"
    );
  });

  it("accepts explicit Fabric settings in production", () => {
    process.env.NODE_ENV = "production";
    process.env.FABRIC_PEER_ENDPOINT = "peer.example.com:7051";
    process.env.FABRIC_TLS_ROOT_CERT = "/run/secrets/fabric-ca.pem";
    process.env.FABRIC_MSP_ID = "Org1MSP";
    process.env.FABRIC_IDENTITY_CERT = "/run/secrets/identity.pem";
    process.env.FABRIC_PRIVATE_KEY = "/run/secrets/identity-key.pem";
    process.env.FABRIC_CHANNEL = "vslchannel";
    process.env.FABRIC_CHAINCODE = "vsl-anchor";

    expect(getFabricRuntimeConfig()).toEqual({
      peerEndpoint: "peer.example.com:7051",
      tlsRootCertPath: "/run/secrets/fabric-ca.pem",
      mspId: "Org1MSP",
      identityCertPath: "/run/secrets/identity.pem",
      privateKeyPath: "/run/secrets/identity-key.pem",
      channelName: "vslchannel",
      chaincodeName: "vsl-anchor"
    });
  });

  it("keeps local Fabric defaults outside production", () => {
    process.env.NODE_ENV = "development";
    delete process.env.FABRIC_PEER_ENDPOINT;
    delete process.env.FABRIC_TLS_ROOT_CERT;
    delete process.env.FABRIC_MSP_ID;
    delete process.env.FABRIC_IDENTITY_CERT;
    delete process.env.FABRIC_PRIVATE_KEY;
    delete process.env.FABRIC_CHANNEL;
    delete process.env.FABRIC_CHAINCODE;

    const config = getFabricRuntimeConfig();

    expect(config.peerEndpoint).toBe("localhost:7051");
    expect(config.mspId).toBe("Org1MSP");
    expect(config.channelName).toBe("vslchannel");
    expect(config.chaincodeName).toBe("vsl-anchor");
  });
});
