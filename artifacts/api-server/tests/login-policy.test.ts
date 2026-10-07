import assert from "node:assert/strict";
import test from "node:test";
import { allowsLoginPassword, allowsShortPasswordRole } from "../src/lib/login-policy.ts";

test("Only the two approved identities accept a four-digit numeric login password", () => {
  // Synthetic test input, not either account's credential.
  for (const username of ["User1", "Staff1"]) {
    assert.equal(allowsLoginPassword(username, "0000"), true);
    for (const password of ["", "000", "00000", "0000000", "abcd", "00 0"]) {
      assert.equal(allowsLoginPassword(username, password), false);
    }
  }
  for (const username of ["someone", "user1", "staff1", "constructor", "__proto__"]) {
    assert.equal(allowsLoginPassword(username, "0000"), false);
  }
});

test("Normal passwords remain valid, with the existing maximum length", () => {
  for (const username of ["User1", "Staff1", "someone"]) {
    assert.equal(allowsLoginPassword(username, "normal-test-password"), true);
    assert.equal(allowsLoginPassword(username, "x".repeat(129)), false);
  }
});

test("Short-password exception cannot confer or follow elevated database roles", () => {
  assert.equal(allowsShortPasswordRole("User1", "0000", "resident"), true);
  assert.equal(allowsShortPasswordRole("Staff1", "0000", "staff"), true);
  for (const role of ["admin", "city_staff_admin", "staff"]) {
    assert.equal(allowsShortPasswordRole("User1", "0000", role), false);
  }
  for (const role of ["admin", "city_staff_admin", "resident"]) {
    assert.equal(allowsShortPasswordRole("Staff1", "0000", role), false);
  }
  assert.equal(allowsShortPasswordRole("constructor", "0000", "staff"), false);
  assert.equal(allowsShortPasswordRole("someone", "normal-test-password", "resident"), true);
});
