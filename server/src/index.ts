import app from "./app";
import { logger } from "./lib/logger";
import { startMathEngine, stopMathEngine } from "./lib/math-engine";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await startMathEngine();

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

function shutdown() {
  stopMathEngine();
  server.close(() => process.exit());
  setTimeout(() => process.exit(1), 2000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
