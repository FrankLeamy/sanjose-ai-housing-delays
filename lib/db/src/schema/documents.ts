import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { submissionsTable } from "./submissions";

export const documentsTable = pgTable("documents", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  submissionId: integer("submission_id").references(() => submissionsTable.id),
  name: text("name").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  objectPath: text("object_path").notNull().unique(),
  generation: text("generation"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("documents_owner_idx").on(t.userId), index("documents_submission_idx").on(t.submissionId)]);