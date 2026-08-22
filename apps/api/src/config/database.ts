import { Pool } from "pg";

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://vsl:vsl_dev_password@127.0.0.1:5432/vsl",
  max: 10
});
