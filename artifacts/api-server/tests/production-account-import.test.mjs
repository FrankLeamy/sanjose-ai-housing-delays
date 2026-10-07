import assert from "node:assert/strict";
import test from "node:test";
import { buildProductionAccountImport } from "../scripts/prepare-production-accounts.mjs";

const fixtures = () => [
  { username: "User1", role: "resident", passwordHash: "$2b$12$" + "A".repeat(53) },
  { username: "Staff1", role: "staff", passwordHash: "$2b$12$" + "B".repeat(53) },
];

test("Import is data-only, atomic, duplicate-safe, and checks case-insensitive account conflicts", () => {
  const sql = buildProductionAccountImport(fixtures());
  assert.match(sql, /BEGIN;\nLOCK TABLE public.users/);
  assert.match(sql, /lower\(existing.username\) = lower\(expected.username\)/);
  assert.match(sql, /existing.role IS DISTINCT FROM expected.role/);
  assert.match(sql, /existing.password_hash IS DISTINCT FROM expected.password_hash/);
  assert.match(sql, /ON CONFLICT \(username\) DO NOTHING/);
  assert.match(sql, /END;\n\$account_import\$;/);
  assert.ok(sql.endsWith("COMMIT;\n"));
  assert.doesNotMatch(sql, /\b(?:UPDATE|DELETE|DROP|ALTER|CREATE)\b/i);
  assert.match(sql, /'staff'::public.user_role/);
  assert.doesNotMatch(sql, /'admin'|'city_staff_admin'/);
});

test("Import rejects duplicates, missing accounts, wrong roles, and unvalidated verifier material", () => {
  assert.throws(() => buildProductionAccountImport([fixtures()[0]]));
  assert.throws(() => buildProductionAccountImport([fixtures()[0], fixtures()[0]]));
  assert.throws(() => buildProductionAccountImport(fixtures().map((account) => ({ ...account, role: "admin" }))));
  for (const passwordHash of ["plaintext", "$2b$04$" + "A".repeat(53), "'; DROP TABLE users;--"]) {
    const accounts = fixtures();
    accounts[0].passwordHash = passwordHash;
    assert.throws(() => buildProductionAccountImport(accounts));
  }
});
