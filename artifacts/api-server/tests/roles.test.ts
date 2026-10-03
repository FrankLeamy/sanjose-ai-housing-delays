import assert from "node:assert/strict";
import test from "node:test";
import { isStaffRole } from "../src/lib/roles.ts";
import { isStaffRole as frontendIsStaffRole } from "../../permit-correction-helper/src/lib/roles.ts";

test("Staff roles agree across server authorization and dashboard routing; unknown roles fail closed", () => {
  for (const role of ["staff", "admin", "city_staff_admin"]) {
    assert.equal(isStaffRole(role), true);
    assert.equal(frontendIsStaffRole(role), true);
  }
  for (const role of ["resident", "administrator", "STAFF", "", null, undefined]) {
    assert.equal(isStaffRole(role), false);
    assert.equal(frontendIsStaffRole(role), false);
  }
});