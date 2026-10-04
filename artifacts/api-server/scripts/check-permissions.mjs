import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Read-only checks, except requests that must be rejected without changing data.
const fileIndex = process.argv.indexOf("--credentials-file");
const credentialsFile = fileIndex < 0 ? "/tmp/permit-demo-credentials.json" : process.argv[fileIndex + 1];
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
if (!process.env.REPLIT_DEV_DOMAIN) throw new Error("Run this check in the development workspace.");
const { accounts } = JSON.parse(await readFile(credentialsFile, "utf8"));
const client = () => {
  let cookie = "";
  return async (path, method = "GET", data) => {
    const response = await fetch(`${base}/api${path}`, {
      method, headers: { ...(cookie ? { cookie } : {}), ...(data ? { "content-type": "application/json" } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}),
      redirect: "manual",
    });
    const sessionCookie = response.headers.getSetCookie().find((value) => value.startsWith("permit.sid="));
    if (sessionCookie) cookie = sessionCookie.split(";")[0];
    const type = response.headers.get("content-type") ?? "";
    const body = type.includes("application/json") ? await response.json() : await response.text();
    return { status: response.status, body, headers: response.headers };
  };
};
const staff = client(), a = client(), b = client(), anonymous = client();
for (const [request, account] of [[staff, accounts[0]], [a, accounts[1]], [b, accounts[2]]]) {
  const accountType = account.role === "resident" ? "resident" : "city_staff";
  const wrongType = client();
  assert.equal((await wrongType("/login", "POST", {
    username: account.username, password: account.password,
    accountType: accountType === "resident" ? "city_staff" : "resident",
  })).status, 403);
  assert.equal((await wrongType("/me")).body, null, "Wrong account type must not create a session.");
  const result = await request("/login", "POST", { username: account.username, password: account.password, accountType });
  assert.equal(result.status, 200);
  assert.equal(result.body.role, account.role);
  assert.ok(!("passwordHash" in result.body));
}
const aList = (await a("/submissions")).body;
const bList = (await b("/submissions")).body;
assert.ok(aList.length && bList.length, "Demo residents need separate submissions.");
assert.ok(aList.every((row) => row.resident === accounts[1].username));
assert.ok(bList.every((row) => row.resident === accounts[2].username));
const staffList = (await staff("/staff/submissions")).body;
assert.ok([...aList, ...bList].every((row) => staffList.some((entry) => entry.id === row.id)));
for (const [owner, other, ownRows, otherRows] of [[a, b, aList, bList], [b, a, bList, aList]]) {
  const denied = await owner(`/submissions/${otherRows[0].id}`);
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error, "Unauthorized access");
  assert.equal((await owner(`/submissions/${otherRows[0].id}?role=city_staff_admin&userId=${accounts[0].id}&permitNumber=${encodeURIComponent(ownRows[0].permitNumber)}`)).status, 403);
  assert.equal((await owner("/staff/submissions")).status, 403);
  assert.equal((await owner(`/staff/submissions?role=city_staff_admin&userId=${accounts[0].id}`)).status, 403);
  assert.equal((await owner(`/staff/submissions/${ownRows[0].id}/notes`)).status, 403);
  assert.equal((await owner(`/staff/submissions/${ownRows[0].id}/notes`, "POST", { body: "Must not be saved" })).status, 403);
  assert.equal((await owner(`/staff/submissions/${ownRows[0].id}`, "PATCH", { status: "review_complete", reviewMessage: "Must not be saved" })).status, 403);
  assert.equal((await owner("/staff/accounts", "POST", { username: "must_not_be_created", password: accounts[1].password })).status, 403);
  const spoofed = await owner(`/submissions?userId=${otherRows[0].resident}&permitNumber=${encodeURIComponent(otherRows[0].permitNumber)}`);
  assert.deepEqual(spoofed.body, ownRows);
  assert.deepEqual((await owner(`/submissions?userId=${otherRows[0].resident}&role=city_staff_admin&includeNotes=true`)).body, ownRows);
  for (const row of ownRows) {
    const detail = await owner(`/submissions/${row.id}`);
    assert.equal(detail.status, 200);
    for (const property of ["staffNotes", "notes", "authorId", "userId", "objectPath"]) assert.ok(!(property in detail.body));
    const notes = (await staff(`/staff/submissions/${row.id}/notes`)).body;
    const residentPayload = JSON.stringify(detail.body);
    for (const note of notes) assert.ok(!residentPayload.includes(JSON.stringify(note.body).slice(1, -1)));
    for (const document of detail.body.documents) {
      assert.equal((await owner(`/documents/${document.id}`)).status, 200);
      assert.equal((await staff(`/documents/${document.id}`)).status, 200);
      assert.equal((await other(`/documents/${document.id}`)).status, 403);
      assert.equal((await other("/submissions", "POST", {
        kind: "correction", subject: "Must not be saved", message: "Ownership check", documentIds: [document.id],
      })).status, 403);
    }
  }
}
for (const path of ["/submissions", "/reports", "/questions", "/notifications", "/staff/submissions", `/documents/missing`, `/staff/submissions/${aList[0].id}/notes`]) {
  assert.equal((await anonymous(path)).status, 401);
}
assert.equal((await anonymous("/signup", "POST", { username: "must_not_be_created", password: accounts[1].password, role: "city_staff_admin" })).status, 400);
const permitRecords = (await a("/public-permits")).body;
assert.equal(permitRecords.length, 24);
for (const [path, filters] of [
  ["/staff/submissions?resident=", (row) => row.resident === accounts[1].username],
]) {
  const filtered = await staff(`${path}${accounts[1].username}`);
  assert.equal(filtered.status, 200);
  assert.ok(filtered.body.length && filtered.body.every(filters));
}
assert.equal((await staff("/staff/submissions?fromDate=1970-01-01&toDate=2100-01-01")).status, 200);
assert.equal((await staff("/staff/submissions?fromDate=2026-02-30")).status, 400);
assert.equal((await staff("/staff/submissions?fromDate=2026-10-02&toDate=2026-10-01")).status, 400);
assert.equal((await staff("/reports")).status, 403, "Resident Past Reports must not be available to staff.");
for (const [resident, username] of [[a, accounts[1].username], [b, accounts[2].username]]) {
  const reports = (await resident("/reports")).body;
  for (const report of reports) {
    assert.equal((await staff(`/reports/${report.id}`)).status, 200, "Staff can still review submitted report details.");
  }
  const otherReports = (await (username === accounts[1].username ? b : a)("/reports")).body;
  for (const report of otherReports) {
    assert.equal((await resident(`/reports/${report.id}`)).status, 403);
    if (report.items[0]) assert.equal((await resident(`/reports/${report.id}/items/${report.items[0].id}`, "PATCH", { completed: true })).status, 403);
  }
}
assert.equal((await a("/logout", "POST")).status, 204);
assert.equal((await a("/submissions")).status, 401);
console.log("PASS: current roles, A/B isolation, staff access, private notes/documents, ID and parameter tampering, public role escalation, anonymous guards, date filters, source permit count, and logout.");