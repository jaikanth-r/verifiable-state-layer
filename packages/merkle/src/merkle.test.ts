import { describe, expect, it } from "vitest";
import {
  buildMerkleRoot,
  createMerkleProof,
  verifyMerkleProof
} from "./merkle.js";

describe("Merkle tree", () => {
  const leaves = [
    "event-hash-001",
    "event-hash-002",
    "event-hash-003",
    "event-hash-004"
  ];

  it("produces a deterministic root", () => {
    expect(buildMerkleRoot(leaves)).toBe(buildMerkleRoot(leaves));
  });

  it("changes the root when a leaf changes", () => {
    const original = buildMerkleRoot(leaves);

    const modified = buildMerkleRoot([
      "event-hash-001",
      "event-hash-CHANGED",
      "event-hash-003",
      "event-hash-004"
    ]);

    expect(modified).not.toBe(original);
  });

  it("creates and verifies a valid proof", () => {
    const proof = createMerkleProof(leaves, 2);

    expect(verifyMerkleProof(proof)).toBe(true);
  });

  it("rejects a modified leaf", () => {
    const proof = createMerkleProof(leaves, 2);

    const modifiedProof = {
      ...proof,
      leaf: "event-hash-TAMPERED"
    };

    expect(verifyMerkleProof(modifiedProof)).toBe(false);
  });

  it("rejects a modified root", () => {
    const proof = createMerkleProof(leaves, 2);

    const modifiedProof = {
      ...proof,
      root: "0000000000000000000000000000000000000000000000000000000000000000"
    };

    expect(verifyMerkleProof(modifiedProof)).toBe(false);
  });

  it("rejects an invalid index", () => {
    expect(() => createMerkleProof(leaves, 99)).toThrow(
      "Invalid target index"
    );
  });

  it("rejects an empty tree", () => {
    expect(() => buildMerkleRoot([])).toThrow(
      "Cannot build Merkle root from empty leaves"
    );
  });
});
