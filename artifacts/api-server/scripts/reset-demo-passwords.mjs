import { randomUUID } from "node:crypto";
import { open, unlink } from "node:fs/promises";
import pg from "pg";
import bcrypt from "bcrypt";
import { generateDemoPasswords } from "./demo-passwords.mjs";

if (process.env.NODE_ENV !== "development" || !process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DEPLOYMENT) {
  throw new Error("Demo password resets are available only in the Replit development workspace.");
}

const accounts = [
  { label: "City Staff", username: "city_staff_reviewer" },
  { label: "Resident 1", username: "resident1" },
  { label: "Resident B", username: "demo_resident_b" },
];
const passwords = generateDemoPasswords(accounts.length);
const destination = `/tmp/permit-demo-${randomUUID()}.json`;
const file = await open(destination, "wx", 0o600);
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
let committed = false;
try {
  await client.connect();
  await client.query("BEGIN");
  for (const [index, account] of accounts.entries()) {
    const { rows: [user] } = await client.query(
      "SELECT id, role, is_demo FROM users WHERE username=$1 FOR UPDATE", [account.username],
    );
    if (!user?.is_demo) throw new Error("Reset requires all three existing tagged demo accounts. No real accounts will be changed.");
    account.id = user.id;
    account.role = user.role;
    account.password = passwords[index];
    const hash = await bcrypt.hash(account.password, 12);
    await client.query("UPDATE users SET password_hash=$1 WHERE id=$2 AND is_demo=true", [hash, user.id]);
  }
  // Save before committing so a failed credential-file write rolls back the reset.
  await file.writeFile(JSON.stringify({ accounts }, null, 2));
  await client.query("COMMIT");
  committed = true;
  console.log(`Reset only the three named demo passwords. Owner-only credentials file: ${destination}`);
  if (process.argv.includes("--show-passwords")) {
    for (const account of accounts) console.log(`${account.label}: ${account.username} / ${account.password}`);
  } else {
    console.log("Passwords were not printed. Run reset:demo-passwords --show-passwords in the development terminal to reset and display them.");
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