import { index, integer, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { reportsTable } from "./reports";
import { permitQuestionsTable } from "./permit-questions";

export const reviewStatus = pgEnum("review_status", ["submitted", "in_review", "changes_requested", "review_complete"]);
export const submissionKind = pgEnum("submission_kind", ["permit", "correction", "question", "report"]);
export const submissionsTable = pgTable("submissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  kind: submissionKind("kind").notNull(),
  subject: text("subject").notNull(),
  permitNumber: text("permit_number").notNull().default(""),
  address: text("address").notNull().default(""),
  message: text("message").notNull().default(""),
  status: reviewStatus("status").notNull().default("submitted"),
  reviewMessage: text("review_message").notNull().default(""),
  reportId: integer("report_id").unique().references(() => reportsTable.id),
  questionId: integer("question_id").unique().references(() => permitQuestionsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("submissions_owner_idx").on(t.userId)]);

export const staffNotesTable = pgTable("staff_notes", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => submissionsTable.id),
  authorId: integer("author_id").notNull().references(() => usersTable.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("staff_notes_submission_idx").on(t.submissionId)]);