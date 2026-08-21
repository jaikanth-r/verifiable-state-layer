import { createHash } from "node:crypto";

export interface MerkleProof {
  leaf: string;
  index: number;
  siblings: string[];
  root: string;
}

function hashPair(left: string, right: string): string {
  return createHash("sha256")
    .update(`${left}${right}`, "utf8")
    .digest("hex");
}

export function hashLeaf(value: string): string {
  return createHash("sha256")
    .update(`leaf:${value}`, "utf8")
    .digest("hex");
}

export function buildMerkleRoot(leaves: string[]): string {
  if (leaves.length === 0) {
    throw new Error("Cannot build Merkle root from empty leaves");
  }

  let level = leaves.map(hashLeaf);

  while (level.length > 1) {
    const next: string[] = [];

    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? left;

      next.push(hashPair(left, right));
    }

    level = next;
  }

  return level[0];
}

export function createMerkleProof(
  leaves: string[],
  targetIndex: number
): MerkleProof {
  if (leaves.length === 0) {
    throw new Error("Cannot create proof from empty leaves");
  }

  if (
    targetIndex < 0 ||
    targetIndex >= leaves.length ||
    !Number.isInteger(targetIndex)
  ) {
    throw new Error("Invalid target index");
  }

  let level = leaves.map(hashLeaf);
  let index = targetIndex;
  const siblings: string[] = [];

  while (level.length > 1) {
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    const sibling = level[siblingIndex] ?? level[index];

    siblings.push(sibling);

    const next: string[] = [];

    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? left;

      next.push(hashPair(left, right));
    }

    index = Math.floor(index / 2);
    level = next;
  }

  return {
    leaf: leaves[targetIndex],
    index: targetIndex,
    siblings,
    root: level[0]
  };
}

export function verifyMerkleProof(proof: MerkleProof): boolean {
  let current = hashLeaf(proof.leaf);
  let index = proof.index;

  for (const sibling of proof.siblings) {
    if (index % 2 === 0) {
      current = hashPair(current, sibling);
    } else {
      current = hashPair(sibling, current);
    }

    index = Math.floor(index / 2);
  }

  return current === proof.root;
}
