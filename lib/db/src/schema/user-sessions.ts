import { index, json, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

// Column layout expected by connect-pg-simple's PostgreSQL session store.
export const userSessionsTable = pgTable(
  "user_sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6 }).notNull(),
  },
  (table) => [index("user_sessions_expire_idx").on(table.expire)],
);