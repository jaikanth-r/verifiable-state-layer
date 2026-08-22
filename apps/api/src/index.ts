import { buildServer } from "./server.js";
import { closeServices } from "./services/application.js";

const app = buildServer();

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });

  const shutdown = async () => {
    await app.close();
    await closeServices();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
