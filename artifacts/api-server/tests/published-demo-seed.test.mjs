import assert from "node:assert/strict";
import test from "node:test";
import { buildAccountSeed } from "../scripts/export-published-demo-accounts.mjs";

const fixtures = () => [
  { username: "city_staff_reviewer", role: "city_staff_admin", is_demo: true, display_name: "Staff", email: "staff@example.com", password_hash: "$2b$12$" + "A".repeat(53) },
  { username: "resident1", role: "resident", is_demo: true, display_name: "Resident", email: "resident@example.com", password_hash: "$2b$12$" + "B".repeat(53) },
];

test("Account seed preserves hashes and staff aliases, avoids overwrites, and guards identity conflicts", () => {
  for (const role of ["city_staff_admin", "staff", "admin"]) {
    const accounts = fixtures();
    accounts[0].role = role;
    const sql = buildAccountSeed(accounts);
    assert.ok(sql.includes(accounts[0].password_hash));
    assert.ok(sql.includes(accounts[1].password_hash));
    assert.ok(sql.includes(`'${role}'`));
    assert.ok(sql.includes("ON CONFLICT (username) DO NOTHING"));
    assert.ok(sql.includes("existing.password_hash IS DISTINCT FROM expected.password_hash"));
    assert.ok(sql.includes("lower(existing.email) = lower(expected.email)"));
    assert.ok(!/\b(?:UPDATE|DELETE|DROP|ALTER|CREATE)\b/i.test(sql));
    assert.ok(sql.startsWith("-- CONFIDENTIAL"));
    assert.ok(sql.endsWith("COMMIT;\n"));
  }
});

test("Account seed fails closed on missing, duplicate, non-demo, or incorrectly-typed accounts", () => {
  assert.throws(() => buildAccountSeed(fixtures().slice(0, 1)));
  assert.throws(() => buildAccountSeed([fixtures()[0], fixtures()[0]]));
  for (const change of [
    { is_demo: false }, { role: "resident" }, { password_hash: "plaintext" }, { email: null },
  ]) {
    const accounts = fixtures();
    Object.assign(accounts[0], change);
    assert.throws(() => buildAccountSeed(accounts));
  }
});

test("Account seed escapes quoted profile metadata", () => {
  const accounts = fixtures();
  accounts[1].display_name = "Resident's demo";
  accounts[1].email = "resident'quoted@example.com";
  const sql = buildAccountSeed(accounts);
  assert.ok(sql.includes("'Resident''s demo'"));
  assert.ok(sql.includes("'resident''quoted@example.com'"));
});