import assert from "node:assert/strict";
import test from "node:test";
import { generateDemoPasswords } from "../scripts/demo-passwords.mjs";

test("Demo passwords are distinct, 12 characters, and easy to type", () => {
  const passwords = generateDemoPasswords(100);
  assert.equal(passwords.length, 100);
  assert.equal(new Set(passwords).size, 100);
  for (const password of passwords) {
    assert.equal(password.length, 12);
    assert.match(password, /^[abcdefghjkmnpqrstuvwxyz23456789]+$/);
    assert.match(password, /[a-z]/);
    assert.match(password, /[0-9]/);
    assert.ok(password.length >= 8 && password.length <= 128);
  }
});