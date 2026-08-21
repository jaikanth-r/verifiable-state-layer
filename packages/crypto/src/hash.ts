import { createHash } from "node:crypto";
import { canonicalize } from "./canonicalize.js";

export function sha256(value: unknown): string {
  const canonical = canonicalize(value);

  return createHash("sha256")
    .update(canonical, "utf8")
    .digest("hex");
}
