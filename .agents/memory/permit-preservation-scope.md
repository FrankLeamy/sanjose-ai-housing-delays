---
name: Preserve the existing permit prototype
description: Scope constraint for role and submission changes.
---

Changes to roles and private submissions must remain additive. Preserve the
current resident layout, existing features, source permit records, and existing
data. Do not redesign, delete data, or replace the authentication system without
an explicit new request.

**Why:** The user explicitly requested the smallest safe change to the existing
prototype, with its layout, permit records and features unchanged, and password
hashing through the existing authentication system.

**How to apply:** Extend the existing product and guards. Separate new staff-only
capabilities from resident features; ask before destructive migrations, provider
changes, or broad redesigns.

Keep submissions in the existing Home page section, without a duplicate top-level
Submissions navigation tab.

**Why:** The user explicitly requested removal of the recently added duplicate
tab while retaining the Home section, current layout, and all submission data.

**How to apply:** Do not reintroduce that navigation tab when extending submission
features. Removing navigation must not remove underlying records or capabilities.

Staff and residents must use separate dashboard navigation. Staff/admin users
must not see resident Home, History, or Past Reports sections, even through a direct URL.
Residents retain their existing dashboard and can see only their own private data.

**Why:** The user explicitly clarified that a shared header exposing resident
sections to City Staff is not acceptable, while requesting preservation of the
existing data and layout.

**How to apply:** Keep role-specific navigation and routing while preserving
resident features and staff review tools. Database-loaded roles, not client inputs,
must remain authoritative for all private data and internal-note permissions.

There are two user-facing account types: City Staff (reviewers) and Residents
(people who submit). Login must offer a choice between these types.

**Why:** The user explicitly described these two account types and requested
a login choice, while retaining database-authoritative roles and existing accounts.

**How to apply:** Keep these two labels in account-facing UX; internal staff/admin
role aliases must not introduce extra public account categories or self-service
staff promotion.