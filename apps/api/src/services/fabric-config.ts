export interface FabricRuntimeConfig {
  peerEndpoint: string;
  tlsRootCertPath: string;
  mspId: string;
  identityCertPath: string;
  privateKeyPath: string;
  channelName: string;
  chaincodeName: string;
}

function requiredProductionEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `${name} is required when NODE_ENV=production`
    );
  }

  return value;
}

export function getFabricRuntimeConfig(): FabricRuntimeConfig {
  const nodeEnv = process.env.NODE_ENV ?? "development";

  if (nodeEnv === "production") {
    return {
      peerEndpoint: requiredProductionEnv("FABRIC_PEER_ENDPOINT"),
      tlsRootCertPath: requiredProductionEnv("FABRIC_TLS_ROOT_CERT"),
      mspId: requiredProductionEnv("FABRIC_MSP_ID"),
      identityCertPath: requiredProductionEnv("FABRIC_IDENTITY_CERT"),
      privateKeyPath: requiredProductionEnv("FABRIC_PRIVATE_KEY"),
      channelName: requiredProductionEnv("FABRIC_CHANNEL"),
      chaincodeName: requiredProductionEnv("FABRIC_CHAINCODE")
    };
  }

  const home = process.env.HOME;

  if (!home) {
    throw new Error("HOME is required for development Fabric configuration");
  }

  const base =
    `${home}/fabric-samples/test-network/organizations/peerOrganizations/` +
    "org1.example.com";

  return {
    peerEndpoint: process.env.FABRIC_PEER_ENDPOINT ?? "localhost:7051",
    tlsRootCertPath:
      process.env.FABRIC_TLS_ROOT_CERT ??
      `${base}/tlsca/tlsca.org1.example.com-cert.pem`,
    mspId: process.env.FABRIC_MSP_ID ?? "Org1MSP",
    identityCertPath:
      process.env.FABRIC_IDENTITY_CERT ??
      `${base}/users/Admin@org1.example.com/msp/signcerts/` +
      "Admin@org1.example.com-cert.pem",
    privateKeyPath:
      process.env.FABRIC_PRIVATE_KEY ??
      `${base}/users/Admin@org1.example.com/msp/keystore/priv_sk`,
    channelName: process.env.FABRIC_CHANNEL ?? "vslchannel",
    chaincodeName: process.env.FABRIC_CHAINCODE ?? "vsl-anchor"
  };
}
