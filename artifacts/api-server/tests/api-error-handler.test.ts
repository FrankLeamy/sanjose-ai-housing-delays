import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import { apiErrorHandler } from "../src/middlewares/api-error-handler.ts";

test("API errors stay JSON without leaking parser bodies or internal details", async (t) => {
  const app = express();
  app.use(express.json({ limit: "1kb" }));
  app.post("/check", (_req, res) => {
    res.status(401).json({ error: "Incorrect username or password." });
  });
  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.get("/failure", () => {
    throw new Error("private-internal-detail");
  });
  app.use(apiErrorHandler);

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeIdleConnections();
  }));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;

  for (const body of ["null", '{"username":', '{"private-input":invalid}']) {
    const response = await fetch(`${base}/check`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    assert.equal(response.status, 400);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    assert.deepEqual(await response.json(), { error: "Invalid JSON or request body." });
  }

  const oversized = await fetch(`${base}/check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ value: "x".repeat(1024) }),
  });
  assert.equal(oversized.status, 413);
  assert.deepEqual(await oversized.json(), { error: "Request body is too large." });

  const validation = await fetch(`${base}/check`, {
    method: "POST", headers: { "content-type": "application/json" }, body: "{}",
  });
  assert.equal(validation.status, 401);
  assert.deepEqual(await validation.json(), { error: "Incorrect username or password." });
  assert.deepEqual(await (await fetch(`${base}/healthz`)).json(), { status: "ok" });

  const failure = await fetch(`${base}/failure`);
  assert.equal(failure.status, 500);
  assert.deepEqual(await failure.json(), { error: "An unexpected server error occurred." });
});