---
name: Demo accounts across environments
description: Preserve credentials and environment isolation when making Preview demos available in Published.
---

Published must use its production database and authentication environment, not
Preview's database as a shortcut. Replicate only explicitly requested demo
identities without rotating passwords or changing existing roles.

**Why:** The user asked for the same demo credentials in both environments while
preserving production data, account roles, permit data, and all other features.

**How to apply:** Prefer a private, explicit data import of existing password
verifiers. Never add public provisioning endpoints, commit credential material,
or make account seeding an automatic startup action. Database-read checks and
secret-existence checks are not proof of a successful published login; report
unverified production behavior honestly.

Preserve the existing schema: residents use `resident`, and ordinary City Staff
access uses the least-privileged existing `staff` role, not an administrator role.
Login must authenticate generic database accounts against their stored bcrypt
verifiers, without hardcoded identity/password exceptions. Keep normal signup and
staff-account creation password-strength rules unchanged.

**Why:** The requested City Staff label is not a database enum value. The user
subsequently replaced the named short-password exception with a request for
database-driven username/password login with no hardcoded identities.

**How to apply:** Verify existing credentials rather than applying signup password
rules during login; never persist passwords in code, UI, logs, or memory.
Production account creation still requires an
explicit private data import; a prepared import is not a completed live login.

Check production session-cookie security in production mode at the native API,
not solely through Preview's proxy. Preserve HttpOnly, Secure, and SameSite=Lax
for production.

**Why:** This project's proxied Preview was observed rewriting the app's
SameSite=Lax cookie to SameSite=None with Secure for iframe use. A correct native
cookie policy can therefore fail an overly literal Preview-header assertion.

**How to apply:** Filter the application session cookie rather than assuming it
is the first Set-Cookie header. Accept Preview's None only when paired with
Secure; separately verify the production-mode cookie flags.

When the production SQL console instructs the user to select multiple statements
for an automatically wrapped transaction, omit only the import's outer
`BEGIN;` and `COMMIT;`, select the complete remaining import, and run it as one
batch. Keep the `BEGIN` inside a dollar-quoted `DO` block intact.

**Why:** The user encountered this console instruction when attempting the
private account import. Documentation about manual transaction support did not
match the console's instruction; follow the actual interface rather than
running the import statements separately.

**How to apply:** Keep the table lock, conflict guard, insert and verification
query together in the selected batch. The console message alone is not proof
that accounts were imported.

A Database pane “Something went wrong” error is not evidence that the SQL
transaction failed. Check the intended records through a read-only production
query before recommending another import.

**Why:** The pane showed this error after the private import, while a separate
read-only production check confirmed both requested account records and roles.

**How to apply:** Distinguish an interface failure from a database failure;
confirm state before retrying writes, and do not infer password or live-login
verification from record presence alone.