process.env.DATABASE_URL ??=
  process.env.TEST_DATABASE_URL ??
  "postgresql://vsl:vsl_dev_password@127.0.0.1:5432/vsl";
