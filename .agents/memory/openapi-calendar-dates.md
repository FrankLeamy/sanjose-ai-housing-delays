---
name: Calendar-date serialization
description: Generated validators may coerce date-only strings into Date objects.
---

Treat calendar dates as dates, not timezone-dependent instants. Validate the wire
representation and display behavior together; generated OpenAPI/Zod validation
can return Date objects even when the API contract describes a date-only string.

**Why:** A real browser check found a valid calendar date displayed as unavailable
after validation converted the response into an ISO timestamp.

**How to apply:** Preserve the documented date-only representation when sending
validated responses, handle legacy timestamps defensively in displays, and test
both forms without timezone shifts.