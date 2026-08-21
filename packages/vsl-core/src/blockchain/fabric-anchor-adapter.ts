import * as grpc from "@grpc/grpc-js";
import * as crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  connect,
  signers,
  type Contract,
  type Gateway
} from "@hyperledger/fabric-gateway";
import { TextDecoder } from "node:util";

import type {
  AnchorAdapter,
  BlockchainAnchor
} from "./anchor-adapter.js";

export interface FabricAnchorConfig {
  peerEndpoint: string;
  tlsRootCertPath: string;
  mspId: string;
  identityCertPath: string;
  privateKeyPath: string;
  channelName: string;
  chaincodeName: string;
}

export class FabricAnchorAdapter implements AnchorAdapter {
  private constructor(
    private readonly gateway: Gateway,
    private readonly contract: Contract,
    private readonly client: grpc.Client
  ) {}

  static async connect(
    config: FabricAnchorConfig
  ): Promise<FabricAnchorAdapter> {
    const tlsRootCert = await readFile(config.tlsRootCertPath);
    const certificate = await readFile(config.identityCertPath);
    const privateKeyPem = await readFile(config.privateKeyPath);

    const privateKey = crypto.createPrivateKey(privateKeyPem);
    const signer = signers.newPrivateKeySigner(privateKey);

    const client = new grpc.Client(
      config.peerEndpoint,
      grpc.credentials.createSsl(tlsRootCert)
    );

    const gateway = connect({
      client,
      identity: {
        mspId: config.mspId,
        credentials: certificate
      },
      signer
    });

    const network = gateway.getNetwork(config.channelName);
    const contract = network.getContract(config.chaincodeName);

    return new FabricAnchorAdapter(
      gateway,
      contract,
      client
    );
  }

  async anchor(batch: {
    batchId: string;
    merkleRoot: string;
    protocolVersion: string;
  }): Promise<BlockchainAnchor> {
    const anchoredAt = new Date().toISOString();

    const result = await this.contract.submitTransaction(
      "AnchorBatch",
      batch.batchId,
      batch.merkleRoot,
      batch.protocolVersion,
      anchoredAt
    );

    return JSON.parse(
      new TextDecoder().decode(result)
    ) as BlockchainAnchor;
  }

  async getAnchor(
    batchId: string
  ): Promise<BlockchainAnchor | null> {
    try {
      const result = await this.contract.evaluateTransaction(
        "GetAnchor",
        batchId
      );

      return JSON.parse(
        new TextDecoder().decode(result)
      ) as BlockchainAnchor;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes("anchor not found")
      ) {
        return null;
      }

      throw error;
    }
  }

  close(): void {
    this.gateway.close();
    this.client.close();
  }
}
