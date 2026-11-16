import { existsSync } from "node:fs";
import path from "node:path";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// In production the built game is served from here too, so one URL runs everything.
// Resolved from the bundled dist/index.mjs, like the maths engine executable.
const webDir = path.resolve(import.meta.dirname, "../../web/dist/public");
if (existsSync(webDir)) {
  app.use(express.static(webDir));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(webDir, "index.html")));
}

export default app;
