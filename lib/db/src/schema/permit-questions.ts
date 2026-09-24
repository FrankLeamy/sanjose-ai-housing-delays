import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const permitQuestionsTable = pgTable("permit_questions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  question: text("question").notNull(),
  response: text("response").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPermitQuestionSchema = createInsertSchema(permitQuestionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPermitQuestion = z.infer<typeof insertPermitQuestionSchema>;
export type PermitQuestion = typeof permitQuestionsTable.$inferSelect;