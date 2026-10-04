# Roles and private submissions

Public registration always creates a **Resident**. The server reads the account's
current identity and role from the database for each protected request. City Staff
accounts are created by an existing administrator at **Accounts**, or by the
development-only command below. There is no public staff registration or role-change endpoint.

## Dashboard separation

Database roles `staff`, `admin`, and the existing `city_staff_admin` use the
**City Staff Dashboard** at `/staff`. Staff navigation contains Dashboard and
Accounts, not resident Home, History, Past Reports, or Notifications.
Opening a resident dashboard URL as staff redirects to `/staff`; submission
detail URLs redirect to the corresponding staff review. Linked reports remain
available within staff routes.

Login offers **Resident** and **City Staff** choices. The server checks the chosen
type against the database role after verifying the password and before starting
a session. Choosing a type never assigns or changes a role; a mismatch is rejected.
The optional API field preserves compatibility with existing credential-only
clients, which still receive access based solely on the database role.
The resident Past Reports list API rejects staff accounts; individual submitted
report details remain available for staff review.

Residents retain the existing Home layout and resident navigation. Their private
lists and detail endpoints enforce ownership; staff routes and internal notes are
denied server-side. Role parameters in a URL or request do not grant privileges.
Sessions store only the account ID, and protected requests load the role from the
database. `/me` also loads the current database role; the browser refreshes that
session check on mount, focus, and periodically.

For another database, apply `lib/db/migrations/20261002_staff_role_aliases.sql`
before using the `staff` or `admin` role values. This additive migration does not
change any existing account's role or remove data.

## Development demo accounts

In the Replit **development terminal**, run:

```sh
pnpm --filter @workspace/api-server run setup:demo --show-passwords
```

This creates one City Staff administrator (`demo_city_staff`), Resident A
(`demo_resident_a`), and Resident B (`demo_resident_b`), with separate demo
correction requests and private staff notes. Passwords are cryptographically
generated and bcrypt-hashed. They are displayed only when explicitly requested in
this development command, never in the UI, source code, API responses, or startup logs.

Re-running the command rotates **only tagged demo accounts'** passwords.
It does not alter non-demo accounts or delete any existing submissions.
The command also saves temporary credentials to an owner-only file in `/tmp`,
outside the project. Do not copy credentials into the repository. Demo setup
refuses to run outside the development workspace and never runs at server startup.
These are demonstration accounts, not production administrator credentials.

## Additive schema and existing records

### Named role-testing accounts

The current login form uses **usernames**, not email addresses. These accounts
use the existing sessions and bcrypt authentication:

| Account | Name | Email | Login username | Role |
| --- | --- | --- | --- | --- |
| Resident 1 | Alex Resident | resident1@example.com | `resident1` | Resident |
| City Staff | City Staff Reviewer | staff@example.com | `city_staff_reviewer` | City Staff (`city_staff_admin` internally) |
| Existing second resident | Resident B | — | `demo_resident_b` | Resident |

Names and emails are stored as optional account metadata; they do not change
the login form or public registration. Before using this setup in another
development database, apply the additive SQL in
`lib/db/migrations/20261002_demo_profiles.sql` (or the equivalent Drizzle push).

To generate new temporary passwords and display them **only in the development
terminal**, run:

```sh
pnpm --filter @workspace/api-server run setup:demo --named --show-passwords
```

This creates the two named accounts, reuses the existing Resident B account,
and rotates only these three tagged demo accounts' passwords. It refuses to
overwrite non-demo accounts or change roles. It preserves existing submissions.
Resident 1 owns `DEMO-RESIDENT1-001`; Resident B owns `DEMO-B-001`.
Both are sample correction submissions, not changes to public permit records.

For permission tests:

1. Open **Log In** and enter `resident1` with its temporary password.
   Open `/submissions` to find Resident 1's sample; its detail URL is
   `/submissions/<id>`. Resident B's submission must not appear.
2. Log out, then log in as `demo_resident_b` to obtain its sample detail URL.
   This resident must not see Resident 1's submission.
3. While logged in as either resident, open the other resident's detail URL,
   `/staff`, and `/staff/accounts`. Access must be denied. Internal notes must
   never appear in resident details or API responses.
4. Log out and log in as `city_staff_reviewer`. The **Review** dashboard at
   `/staff` must show both samples; staff can open each and read its private notes.
5. To verify record-ID, permit-number, and request-parameter tampering at the
   API level, run the existing permission script using the owner-only credential
   file printed by the named setup:

   ```sh
   pnpm --filter @workspace/api-server exec node scripts/check-permissions.mjs --credentials-file /tmp/permit-demo-EXAMPLE.json
   ```

No passwords are included in these instructions or public responses.

### Short demo-password resets

Reset **only** the existing City Staff, Resident 1, and Resident B demo passwords:

```sh
pnpm --filter @workspace/api-server run reset:demo-passwords --show-passwords
```

This development-only command generates a separate random **12-character**
password for each account, using lowercase letters and digits with easily confused
characters omitted. These meet the existing 8–128-character authentication policy.
The password policy for real users is not changed. Passwords remain bcrypt-hashed
with cost 12, and are displayed only in the development terminal when explicitly
requested. Temporary credentials are stored outside the project with owner-only
permissions. No roles, profile fields, submissions, notes, permit records, or
non-demo accounts are changed. Rerunning resets these three passwords again.

After applying the additive database schema in the intended environment, run:

```sh
pnpm --filter @workspace/api-server run backfill:submissions
```

This idempotently adds queue entries for existing account-owned reports and
questions. It does not modify source records, passwords, ownership, or public
permit records. Pre-account questions with no verified owner remain unattributed.
Existing accounts default to Resident; there is no automatic administrator promotion.

## Document security

PDF, PNG and JPG files (up to 10 MB each) are uploaded to private storage. The
submission endpoint verifies ownership, size, content type and the file signature,
then pins the file version. Owners and staff download through an authenticated
endpoint; there is no public object-download route. Private staff notes use
separate staff-only endpoints and never appear in resident submission serializers.
API responses are marked private and non-cacheable. Browser writes must be
same-origin, including behind Replit's preview proxy.

Review statuses are application workflow labels, **not official permit approval**.
The existing correction-report analysis remains the prototype's simulated analysis.

## Repeatable permission checks

After creating the demo accounts, use the temporary credential-file path printed
by setup (do not paste passwords into commands):

```sh
pnpm --filter @workspace/api-server exec node scripts/check-permissions.mjs --credentials-file /tmp/permit-demo-EXAMPLE.json
pnpm --filter @workspace/api-server exec node --experimental-strip-types --test tests/*.test.ts
```

The first command checks live role and ownership enforcement, private
notes/documents, request tampering, public signup restrictions, anonymous access,
date filters, logout and the existing source permit count. It does not create,
delete, or change records; mutation attempts in that script must be denied.