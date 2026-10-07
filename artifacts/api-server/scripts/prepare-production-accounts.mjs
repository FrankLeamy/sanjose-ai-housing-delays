import bcrypt from "bcrypt";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const identities = [
  { username: "User1", role: "resident", secret: "RESIDENT_ACCOUNT_PASSWORD" },
  { username: "Staff1", role: "staff", secret: "STAFF_ACCOUNT_PASSWORD" },
];

export function buildProductionAccountImport(accounts) {
  if (accounts.length !== identities.length || identities.some((identity) =>
    accounts.filter((account) => account.username === identity.username && account.role === identity.role).length !== 1
  ) || accounts.some((account) => !/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(account.passwordHash))) {
    throw new Error("Expected exactly the two approved identities, roles, and bcrypt cost-12 verifiers.");
  }
  // Names, roles, and hashes have strict allowlists above; no free-form SQL values.
  const rows = accounts.map((account) =>
    `('${account.username}', '${account.passwordHash}', '${account.role}'::public.user_role)`
  ).join(",\n    ");
  return `-- PRIVATE: password verifiers only; no plaintext passwords.
-- Run this complete file in the PRODUCTION SQL editor after publishing the login exception.
-- Re-running this same file is safe. Conflicting accounts abort the entire import.
BEGIN;
LOCK TABLE public.users IN SHARE ROW EXCLUSIVE MODE;
DO $account_import$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.users AS existing
    JOIN (VALUES
    ${rows}
    ) AS expected(username, password_hash, role)
      ON lower(existing.username) = lower(expected.username)
    WHERE existing.username IS DISTINCT FROM expected.username
       OR existing.role IS DISTINCT FROM expected.role
       OR existing.password_hash IS DISTINCT FROM expected.password_hash
  ) THEN
    RAISE EXCEPTION 'Account conflict. Nothing was changed; existing accounts were not overwritten.';
  END IF;
END;
$account_import$;
INSERT INTO public.users (username, password_hash, role)
VALUES
    ${rows}
ON CONFLICT (username) DO NOTHING;
SELECT username, role FROM public.users WHERE username IN ('User1', 'Staff1') ORDER BY username;
COMMIT;
`;
}

async function prepareImport() {
  if (process.env.NODE_ENV !== "development" || !process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DEPLOYMENT) {
    throw new Error("Preparation must run only in the development workspace.");
  }
  const accounts = [];
  for (const identity of identities) {
    const password = process.env[identity.secret];
    if (!password || !/^[0-9]{4}$/.test(password)) throw new Error("Both approved account passwords must be supplied through Secrets.");
    const passwordHash = await bcrypt.hash(password, 12);
    if (!await bcrypt.compare(password, passwordHash)) throw new Error("Password verifier self-check failed.");
    accounts.push({ username: identity.username, role: identity.role, passwordHash });
  }
  const directory = await mkdtemp(join(tmpdir(), "permit-production-accounts-"));
  await chmod(directory, 0o700);
  const destination = join(directory, "production-accounts.sql");
  await writeFile(destination, buildProductionAccountImport(accounts), { mode: 0o600, flag: "wx" });
  console.log(`Private production import prepared: ${destination}`);
  console.log("Both bcrypt verifiers passed their self-checks. No database was modified and no passwords or hashes were printed.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  prepareImport().catch(() => {
    console.error("Import preparation failed. Check both account Secrets and the development environment. No database was modified.");
    process.exitCode = 1;
  });
}
