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