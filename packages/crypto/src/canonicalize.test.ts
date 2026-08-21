import { describe, expect, it } from "vitest";
import { canonicalize } from "./canonicalize.js";

describe("canonicalize", () => {
  it("produces the same representation regardless of object key order", () => {
    const a = {
      price: 35000,
      customer: "Alice"
    };

    const b = {
      customer: "Alice",
      price: 35000
    };

    expect(canonicalize(a)).toBe(canonicalize(b));
  });
});
