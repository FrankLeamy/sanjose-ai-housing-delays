import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import pg from "pg";
import { randomBytes, randomInt } from "node:crypto";
import { chmod, mkdtemp, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Explicit test command only. No production provisioning or startup side effects.
if (process.env.NODE_ENV !== "development" || !process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DEPLOYMENT) {
  throw new Error("Login checks and fixture cleanup are available only in development.");
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
const accounts = [];
let phase = "fixture preparation";

async function cleanup(rows) {
  for (const row of rows) {
    if (!Number.isInteger(row.id) || !/^login_(resident|staff)_[a-f0-9]{12}$/.test(row.username)) {
      throw new Error("Refusing cleanup of an unrelated identity.");
    }
  }
  await client.query("BEGIN");
  try {
    for (const row of rows) {
      const { rowCount } = await client.query(
        "SELECT id FROM public.users WHERE id=$1 AND username=$2 AND is_demo=TRUE FOR UPDATE", [row.id, row.username],
      );
      if (rowCount !== 1) throw new Error("Test identity changed; cleanup stopped.");
      await client.query("DELETE FROM public.user_sessions WHERE sess->>'userId'=$1", [String(row.id)]);
      await client.query("DELETE FROM public.users WHERE id=$1 AND username=$2 AND is_demo=TRUE", [row.id, row.username]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

function sessionClient() {
  let cookie = "";
  let cookieHeader = "";
  const base = `https://${process.env.REPLIT_DEV_DOMAIN}/api`;
  return {
    get cookie() { return cookie; },
    get cookieHeader() { return cookieHeader; },
    async request(path, method = "GET", body) {
      const response = await fetch(`${base}${path}`, {
        method, redirect: "error",
        headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const sessionCookie = response.headers.getSetCookie().find((value) => value.startsWith("permit.sid="));
      if (sessionCookie) {
        cookieHeader = sessionCookie;
        cookie = sessionCookie.split(";")[0];
      }
      const text = await response.text();
      return { status: response.status, body: text ? JSON.parse(text) : null };
    },
  };
}

try {
  await client.connect();
  if (process.argv[2] === "--cleanup") {
    const fixturePath = process.argv[3];
    if (!fixturePath?.startsWith(`${tmpdir()}/permit-login-check-`)) throw new Error("Invalid fixture file.");
    const fixtures = JSON.parse(await readFile(fixturePath, "utf8"));
    await cleanup(fixtures.accounts);
    await unlink(fixturePath);
    console.log("Only the temporary login-test users and their sessions were removed.");
  } else {
    for (const role of ["resident", "staff"]) {
      const username = `login_${role}_${randomBytes(6).toString("hex")}`;
      const password = String(randomInt(1000, 10000));
      const { rows: [row] } = await client.query(
        "INSERT INTO public.users (username,password_hash,role,is_demo) VALUES ($1,$2,$3,TRUE) RETURNING id",
        [username, await bcrypt.hash(password, 12), role],
      );
      accounts.push({ id: row.id, username, password, role });
    }
    for (const account of accounts) {
      phase = `${account.role} credential rejection`;
      const accountType = account.role === "resident" ? "resident" : "city_staff";
      const invalid = sessionClient();
      const wrongPassword = `${account.password}invalid`;
      assert.equal((await invalid.request("/login", "POST", { username: account.username, password: wrongPassword, accountType })).status, 401);
      assert.equal((await invalid.request("/me")).body, null);
      const wrongType = sessionClient();
      assert.equal((await wrongType.request("/login", "POST", {
        username: account.username, password: account.password, accountType: accountType === "resident" ? "city_staff" : "resident",
      })).status, 403);
      assert.equal((await wrongType.request("/me")).body, null);
      const session = sessionClient();
      phase = `${account.role} successful login`;
      const credentials = { username: account.username, password: account.password, accountType };
      const login = await session.request("/login", "POST", credentials);
      assert.equal(login.status, 200);
      assert.equal(login.body.role, account.role);
      assert.deepEqual(Object.keys(login.body).sort(), ["createdAt", "id", "role", "username"]);
      phase = `${account.role} session cookie`;
      assert.ok(/httponly/i.test(session.cookieHeader), "Session cookie must be HttpOnly.");
      // Preview's iframe proxy rewrites Lax to None; Secure. The app itself keeps
      // SameSite=Lax and enables Secure in production.
      const lax = /samesite=lax/i.test(session.cookieHeader);
      const securePreviewCookie = /samesite=none/i.test(session.cookieHeader) &&
        /;\s*secure(?:;|$)/i.test(session.cookieHeader);
      assert.ok(lax || securePreviewCookie, "SameSite=None must be paired with Secure.");
      const previousCookie = session.cookie;
      phase = `${account.role} session rotation`;
      assert.equal((await session.request("/login", "POST", credentials)).status, 200);
      assert.ok(previousCookie !== session.cookie, "Login must regenerate the session ID.");
      const me = await session.request("/me");
      phase = `${account.role} session persistence`;
      assert.equal(me.body.id, account.id);
      assert.equal(me.body.role, account.role);
      const { rows: [stored] } = await client.query(
        "SELECT count(*)::int AS total FROM public.user_sessions WHERE sess->>'userId'=$1", [String(account.id)],
      );
      assert.ok(stored.total > 0, "Session must be saved in PostgreSQL.");
      phase = `${account.role} role permissions`;
      assert.equal((await session.request("/staff/submissions")).status, account.role === "staff" ? 200 : 403);
      assert.equal((await session.request("/reports")).status, account.role === "resident" ? 200 : 403);
      phase = `${account.role} logout`;
      assert.equal((await session.request("/logout", "POST")).status, 204);
      assert.equal((await session.request("/me")).body, null);
      assert.equal((await session.request("/staff/submissions")).status, 401);
    }
    const directory = await mkdtemp(join(tmpdir(), "permit-login-check-"));
    await chmod(directory, 0o700);
    const fixturePath = join(directory, "browser-fixtures.json");
    await writeFile(fixturePath, JSON.stringify({ accounts }), { mode: 0o600, flag: "wx" });
    console.log("Both roles passed real HTTP login, wrong-password and wrong-type rejection, session rotation/persistence, permission checks, and logout.");
    console.log(`Private browser-test fixtures: ${fixturePath}`);
  }
} catch {
  if (accounts.length) await cleanup(accounts).catch(() => {});
  console.error(`Database login check failed during ${phase}. Credentials were not printed; no production data was modified.`);
  process.exitCode = 1;
} finally {
  await client.end();
}
