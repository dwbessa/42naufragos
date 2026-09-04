import express from "express";
import { callbackRouter } from "./routes/callback.js";

export function createServer() {
  const app = express();
  app.get("/healthz", (_req, res) => res.status(200).send("ok"));
  app.use(callbackRouter);
  return app;
}
