import { jsonb, pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export type StoredReportItem = {
  id: number;
  comment: string;
  status: "met" | "needs_fix";
  howToFix: string;
  department: string;
  category: string;
  unclear: boolean;
  completed: boolean;
};

export const reportsTable = pgTable("reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  address: text("address").notNull(),
  summary: text("summary").notNull(),
  items: jsonb("items").$type<StoredReportItem[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReportSchema = createInsertSchema(reportsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertReport = z.infer<typeof insertReportSchema>;
export type StoredReport = typeof reportsTable.$inferSelect;