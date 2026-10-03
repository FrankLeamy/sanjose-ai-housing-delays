import { randomUUID } from "node:crypto";
import { open, unlink } from "node:fs/promises";
import pg from "pg";
import bcrypt from "bcrypt";
import { backfillSubmissions } from "./backfill-submissions.mjs";
import { generateDemoPasswords } from "./demo-passwords.mjs";

// Never run on application startup or in a published deployment.
if (process.env.NODE_ENV !== "development" || !process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DEPLOYMENT) {
  throw new Error("Demo setup is available only in the Replit development workspace.");
}
const args = process.argv.slice(2);
const destinationIndex = args.indexOf("--credentials-file");
const destination = destinationIndex >= 0 ? args[destinationIndex + 1] : `/tmp/permit-demo-${randomUUID()}.json`;
if (!destination?.startsWith("/tmp/") || destination.includes("/../")) {
  throw new Error("Temporary credentials must be stored outside the workspace, in /tmp.");
}
const named = args.includes("--named");
const generatePasswords = generateDemoPasswords(3);
const credentials = (named ? [
  { label: "City Staff Reviewer", username: "city_staff_reviewer", displayName: "City Staff Reviewer", email: "staff@example.com", role: "city_staff_admin" },
  { label: "Alex Resident (Resident 1)", username: "resident1", displayName: "Alex Resident", email: "resident1@example.com", role: "resident" },
  { label: "Existing Resident B", username: "demo_resident_b", role: "resident" },
] : [
  { label: "City Staff administrator", username: "demo_city_staff", role: "city_staff_admin" },
  { label: "Resident A", username: "demo_resident_a", role: "resident" },
  { label: "Resident B", username: "demo_resident_b", role: "resident" },
]).map((account, index) => ({ ...account, password: generatePasswords[index] }));
const file = await open(destination, "wx", 0o600);
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
let committed = false;
try {
  await client.connect();
  await client.query("BEGIN");
  for (const account of credentials) {
    const existing = await client.query("SELECT id, is_demo, role FROM users WHERE username=$1 FOR UPDATE", [account.username]);
    const user = existing.rows[0];
    if (user && (!user.is_demo || user.role !== account.role)) {
      throw new Error("A demo username belongs to a non-demo account. Setup will not change it.");
    }
    const hash = await bcrypt.hash(account.password, 12);
    const result = user
      ? await client.query(`UPDATE users SET password_hash=$1,
          display_name=COALESCE($3,display_name), email=COALESCE($4,email)
          WHERE id=$2 AND is_demo=true RETURNING id`,
        [hash, user.id, account.displayName ?? null, account.email ?? null])
      : await client.query("INSERT INTO users (username,password_hash,role,is_demo,display_name,email) VALUES ($1,$2,$3,true,$4,$5) RETURNING id",
        [account.username, hash, account.role, account.displayName ?? null, account.email ?? null]);
    account.id = result.rows[0].id;
  }
  const staff = credentials[0];
  for (const [index, resident] of credentials.slice(1).entries()) {
    const label = index === 0 ? "A" : "B";
    const subject = named && index === 0 ? "Resident 1 demo permit submission" : `Demo resident ${label} correction request`;
    const existing = await client.query("SELECT id FROM submissions WHERE user_id=$1 AND subject=$2", [resident.id, subject]);
    if (!existing.rowCount) {
      const result = await client.query(`
        INSERT INTO submissions (user_id,kind,subject,message,permit_number,address)
        VALUES ($1,'correction',$2,$3,$4,$5) RETURNING id
      `, [resident.id, subject, `Demo data for permission testing only. Resident ${label} asks staff to review a revised plan.`,
        named && index === 0 ? "DEMO-RESIDENT1-001" : `DEMO-${label}-001`, `${index === 0 ? "101" : "202"} Example Lane (demo address)`]);
      await client.query("INSERT INTO staff_notes (submission_id,author_id,body) VALUES ($1,$2,$3)",
        [result.rows[0].id, staff.id, `Private demo staff note for Resident ${label}. Never show this in resident responses.`]);
    }
  }
  await backfillSubmissions(client);
  await client.query("COMMIT");
  committed = true;
  await file.writeFile(JSON.stringify({ accounts: credentials }, null, 2));
  console.log(`Development demo accounts ready. Credentials saved to ${destination} with owner-only permissions.`);
  if (args.includes("--show-passwords") && !args.includes("--quiet")) {
    for (const account of credentials) console.log(`${account.label}: ${account.username} / ${account.password}`);
  } else {
    console.log(`Passwords are not printed. Run setup:demo${named ? " --named" : ""} --show-passwords in the development terminal to rotate and display them.`);
  }
} catch (error) {
  if (!committed) {
    await client.query("ROLLBACK").catch(() => {});
    await unlink(destination).catch(() => {});
  }
  throw error;
} finally {
  await file.close();
  await client.end();
}