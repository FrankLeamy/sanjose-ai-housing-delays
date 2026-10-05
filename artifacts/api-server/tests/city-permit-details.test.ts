import assert from "node:assert/strict";
import test from "node:test";
import { cityDate, cityRecordUrl, parseCityPermit } from "../src/lib/city-permit-details.ts";
import { readablePermitDate } from "../../permit-correction-helper/src/lib/permit-format.ts";

const payload = (changes = {}) => ({
  success: true, result: { records: [{
    FOLDERNUMBER: "2026-097731-RS", Status: "Active", FOLDERNAME: "Garage conversion to ADU",
    WORKDESCRIPTION: "New Construction", PERMITAPPROVALS: "B-Complete, E-Complete",
    ISSUEDATE: "9/24/2026 12:00:00 AM", FINALDATE: null,
    DWELLINGUNITS: 1, SQUAREFOOTAGE: "485", PERMITVALUATION: "$85,321",
    OWNERNAME: "PRIVATE OWNER", APPLICANT: "PRIVATE APPLICANT", CONTRACTOR: "PRIVATE CONTRACTOR",
    _id: 123, FOLDERRSN: 456, ASSESSORS_PARCEL_NUMBER: "PRIVATE PARCEL", gx_location: "PRIVATE COORDINATES",
    ...changes,
  }] },
});
test("City records become labeled-view data without owner information or internal fields", () => {
  const details = parseCityPermit(payload(), "2026-097731-RS", "Public address")!;
  assert.equal(details.projectDescription, "Garage conversion to ADU");
  assert.equal(details.workDescription, "New Construction");
  assert.equal(details.approvalStatus, "Building: Complete; Electrical: Complete");
  assert.equal(details.issueDate, "2026-09-24");
  assert.equal(details.finalDate, null);
  assert.equal(details.dwellingUnits, 1);
  assert.equal(details.squareFootage, 485);
  assert.equal(details.valuation, 85321);
  assert.doesNotMatch(JSON.stringify(details), /PRIVATE|FOLDERRSN|FOLDERNAME|OWNERNAME|_id|resource_id/);
});
test("Missing fields remain unavailable, zero stays zero, and object values never become raw JSON", () => {
  const details = parseCityPermit(payload({ Status: {}, DWELLINGUNITS: 0, PERMITVALUATION: null, SQUAREFOOTAGE: "not known", WORKDESCRIPTION: {} }), "2026-097731-RS", "Public address")!;
  assert.equal(details.status, null);
  assert.equal(details.dwellingUnits, 0);
  assert.equal(details.valuation, null);
  assert.equal(details.squareFootage, null);
  assert.equal(details.workDescription, null);
});
test("Missing, malformed and ambiguous records are rejected instead of inventing details", () => {
  assert.equal(parseCityPermit(payload({ FOLDERNUMBER: "other" }), "2026-097731-RS", "Public address"), null);
  assert.throws(() => parseCityPermit({ success: false }, "2026-097731-RS", "Public address"));
  const duplicate = payload();
  duplicate.result.records.push(duplicate.result.records[0]);
  assert.throws(() => parseCityPermit(duplicate, "2026-097731-RS", "Public address"));
});
test("Dates are validated without timezone shifts", () => {
  assert.equal(cityDate("9/24/2026 12:00:00 AM"), "2026-09-24");
  assert.equal(cityDate("2026-09-24T00:00:00"), "2026-09-24");
  for (const invalid of ["2/30/2026", "invalid", null, {}]) assert.equal(cityDate(invalid), null);
});
test("Modal date labels accept date-only and ISO timestamp responses", () => {
  assert.equal(readablePermitDate("2026-09-24"), "Sep 24, 2026");
  assert.equal(readablePermitDate("2026-09-24T00:00:00.000Z"), "Sep 24, 2026");
  assert.equal(readablePermitDate(null), "Not available");
  assert.equal(readablePermitDate("invalid"), "Not available");
});
test("City requests use the trusted host and requested permit, never arbitrary URLs", () => {
  const source = "https://data.sanjoseca.gov/api/3/action/datastore_search?resource_id=761b7ae8-3be1-4ad6-923d-c7af6404a904&filters=old";
  const url = cityRecordUrl(source, "2026-097731-RS");
  assert.deepEqual(JSON.parse(url.searchParams.get("filters")!), { FOLDERNUMBER: "2026-097731-RS" });
  assert.equal(url.searchParams.get("limit"), "2");
  for (const invalid of ["https://evil.example/api", "http://data.sanjoseca.gov/api/3/action/datastore_search", "https://data.sanjoseca.gov/other"]) {
    assert.throws(() => cityRecordUrl(invalid, "2026-097731-RS"));
  }
});