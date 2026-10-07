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

For the two explicitly approved production identities, preserve the existing
schema: the resident uses `resident`, and City Staff access uses the least-
privileged existing `staff` role, not an administrator role. The user approved a
four-digit numeric login exception only for those identities and their designated
roles; keep normal signup and staff-account creation password rules unchanged.

**Why:** The requested City Staff label is not a database enum value, and the
owner chose the existing staff role plus the narrowly scoped login exception.

**How to apply:** Never widen this exception to all accounts or persist passwords
in code, UI, logs, or memory. Production account creation still requires an
explicit private data import; a prepared import is not a completed live login.