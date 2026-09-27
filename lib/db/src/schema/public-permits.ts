import { date, integer, pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const publicPermitsTable = pgTable("public_permits", {
  permitNumber: text("permit_number").primaryKey(),
  address: text("address").notNull(),
  housingType: text("housing_type").notNull(),
  projectDescription: text("project_description").notNull(),
  permitType: text("permit_type").notNull(),
  status: text("status").notNull(),
  issuedDate: date("issued_date", { mode: "string" }),
  finalDate: date("final_date", { mode: "string" }),
  permitApprovals: text("permit_approvals"),
  sourceUrl: text("source_url").notNull(),
  source: text("source").notNull(),
  dataLabel: text("data_label").notNull(),
  displayOrder: integer("display_order").notNull(),
});

export const insertPublicPermitSchema = createInsertSchema(publicPermitsTable);
export type InsertPublicPermit = z.infer<typeof insertPublicPermitSchema>;
export type PublicPermit = typeof publicPermitsTable.$inferSelect;