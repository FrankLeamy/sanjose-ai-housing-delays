import { mkdtemp, writeFile, chmod } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import pg from "pg";

const usernames = ["city_staff_reviewer", "resident1"];
const sqlLiteral = (value) => value == null ? "NULL" : `'${String(value).replaceAll("'", "''")}'`;

// A data-only import: no schema changes, password resets, or updates to existing users.
export function buildAccountSeed(accounts) {
  if (accounts.length !== usernames.length ||
      usernames.some((username) => accounts.filter((row) => row.username === username).length !== 1)) {
    throw new Error("Both named Preview accounts are required, with no duplicates.");
  }
  for (const account of accounts) {
    const validRole = account.username === "resident1"
      ? account.role === "resident"
      : ["staff", "admin", "city_staff_admin"].includes(account.role);
    if (!validRole || account.is_demo !== true || !account.email ||
        !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(account.password_hash)) {
      throw new Error("Preview account identity, demo flag, role, email, or password verifier is invalid.");
    }
  }
  const ordered = usernames.map((username) => accounts.find((row) => row.username === username));
  const identityRows = ordered.map((account) =>
    `(${[account.username, account.email, account.role, account.password_hash].map(sqlLiteral).join(", ")})`).join(",\n      ");
  const insertRows = ordered.map((account) =>
    `(${[account.username, account.password_hash, account.role, account.display_name, account.email].map(sqlLiteral).join(", ")}, TRUE)`).join(",\n  ");
  return `-- CONFIDENTIAL: contains password verifiers, never plaintext passwords.
-- Run manually in the PRODUCTION database SQL editor. Do not commit or share.
BEGIN;
SET LOCAL standard_conforming_strings = on;
LOCK TABLE public.users IN SHARE ROW EXCLUSIVE MODE;
DO $demo_seed_guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.users AS existing
    JOIN (VALUES
      ${identityRows}
    ) AS expected(username, email, role, password_hash)
      ON existing.username = expected.username
      OR lower(existing.email) = lower(expected.email)
    WHERE existing.username IS DISTINCT FROM expected.username
       OR existing.email IS DISTINCT FROM expected.email
       OR existing.role::text IS DISTINCT FROM expected.role
       OR existing.password_hash IS DISTINCT FROM expected.password_hash
       OR existing.is_demo IS DISTINCT FROM TRUE
  ) THEN
    RAISE EXCEPTION 'An existing account conflicts with the Preview identity or credentials. Nothing was changed.';
  END IF;
END
$demo_seed_guard$;
INSERT INTO public.users (username, password_hash, role, display_name, email, is_demo)
VALUES
  ${insertRows}
ON CONFLICT (username) DO NOTHING;
SELECT username, role FROM public.users
WHERE username IN ('city_staff_reviewer', 'resident1') ORDER BY username;
COMMIT;
`;
}

async function exportAccounts() {
  if (process.env.NODE_ENV !== "development" || !process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DEPLOYMENT) {
    throw new Error("Export is available only in the development workspace.");
  }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const { rows } = await client.query(
      "SELECT username, password_hash, role, display_name, email, is_demo FROM users WHERE username = ANY($1::text[])",
      [usernames],
    );
    const sql = buildAccountSeed(rows);
    const directory = await mkdtemp(join(tmpdir(), "permit-account-seed-"));
    await chmod(directory, 0o700);
    const destination = join(directory, "production-accounts.sql");
    await writeFile(destination, sql, { mode: 0o600, flag: "wx" });
    console.log(`Private production account seed saved to: ${destination}`);
    console.log("Existing Preview password verifiers and roles were preserved. No passwords were displayed and no database was modified.");
    console.log("Import this file only in the Production SQL editor. Keep it private and delete it after use.");
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  exportAccounts().catch(() => {
    // Never print driver exceptions: their details could contain account material.
    console.error("Account export failed. Check the development environment and both existing tagged demo accounts. No production changes were made.");
    process.exitCode = 1;
  });
}