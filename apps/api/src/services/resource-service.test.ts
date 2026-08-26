import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { pool } from "../config/database.js";
import {
  createResource,
  type ResourceRecord
} from "./resource-service.js";
import type { AuthContext } from "./auth-context.js";

const auth: AuthContext = {
  userId: "66d5c5fc-c3c4-4e8b-94d3-d4c8c13f666f",
  tenantId: "2a46cf83-111b-4469-9bca-5e16196541f9",
  role: "owner"
};

describe("createResource concurrency", () => {
  beforeEach(async () => {
    await pool.query(
      `
      DELETE FROM resources
      WHERE tenant_id = $1
        AND resource_type = $2
      `,
      [auth.tenantId, "Concurrency Test"]
    );

    await pool.query(
      `
      DELETE FROM resource_reference_counters
      WHERE record_type = $1
        AND reference_year = EXTRACT(YEAR FROM CURRENT_DATE)::int
      `,
      ["CONCURRENCY-TEST"]
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  it("generates unique sequential references under concurrent requests", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        createResource(auth, {
          resourceType: "Concurrency Test"
        })
      )
    );

    const externalIds = results.map(
      (resource: ResourceRecord) => resource.externalId
    );

    expect(new Set(externalIds).size).toBe(10);

    const sequences = externalIds
      .map((externalId) => {
        const match = externalId.match(/-(\d{6})$/);
        if (!match) {
          throw new Error(
            `Unexpected generated reference: ${externalId}`
          );
        }
        return Number(match[1]);
      })
      .sort((a, b) => a - b);

    expect(sequences).toEqual(
      Array.from({ length: 10 }, (_, index) => index + 1)
    );
  });
});
