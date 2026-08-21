import { describe, expect, it } from "vitest";
import { sha256 } from "./hash.js";

describe("sha256", () => {
  it("produces deterministic hashes", () => {
    const value = {
      price: 35000,
      customer: "Alice"
    };

    expect(sha256(value)).toBe(sha256(value));
  });

  it("produces the same hash for equivalent object ordering", () => {
    const a = {
      price: 35000,
      customer: "Alice"
    };

    const b = {
      customer: "Alice",
      price: 35000
    };

    expect(sha256(a)).toBe(sha256(b));
  });
});
