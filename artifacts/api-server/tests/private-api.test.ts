import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import { privateApi } from "../src/middlewares/private-api.ts";

test("Private API responses are not cached and browser writes are same-origin", async (t) => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(privateApi);
  app.all("/check", (_req, res) => res.json({ ok: true }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeIdleConnections();
  }));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const get = await fetch(`${base}/check`);
  assert.equal(get.headers.get("cache-control"), "private, no-store");
  for (const origin of ["https://attacker.example", "null", "invalid"]) {
    const response = await fetch(`${base}/check`, { method: "POST", headers: { origin } });
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "Unauthorized access" });
  }
  assert.equal((await fetch(`${base}/check`, { method: "POST", headers: { origin: base } })).status, 200);
  assert.equal((await fetch(`${base}/check`, { method: "POST", headers: {
    origin: "https://preview.example", "x-forwarded-host": "preview.example", "x-forwarded-proto": "https",
  } })).status, 200);
  assert.equal((await fetch(`${base}/check`, { method: "POST", headers: {
    origin: base, "sec-fetch-site": "cross-site",
  } })).status, 403);
  assert.equal((await fetch(`${base}/check`, { method: "POST" })).status, 200);
});