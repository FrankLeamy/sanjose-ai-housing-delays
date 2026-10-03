import bcrypt from "bcrypt";
import { Router, type IRouter } from "express";
import { and, desc, eq, gte, ilike, lt } from "drizzle-orm";
import { db, notificationsTable, staffNotesTable, submissionsTable, usersTable } from "@workspace/db";
import {
  AddStaffNoteBody, AddStaffNoteParams, AddStaffNoteResponse,
  CreateStaffAccountBody, CreateStaffAccountResponse, ListStaffNotesParams, ListStaffNotesResponse,
  ListStaffSubmissionsQueryParams, ListStaffSubmissionsResponse,
  UpdateSubmissionReviewBody, UpdateSubmissionReviewParams, UpdateSubmissionReviewResponse,
} from "@workspace/api-zod";
import { requireStaff } from "../middlewares/require-user";
import { submissionSelection } from "./submissions";

const router: IRouter = Router();
router.use("/staff", requireStaff);
router.get("/staff/submissions", async (req, res): Promise<void> => {
  const input = ListStaffSubmissionsQueryParams.strict().safeParse(req.query);
  if (!input.success) { res.status(400).json({ error: "Invalid search filters." }); return; }
  const q = input.data;
  for (const value of [q.fromDate, q.toDate]) {
    if (value) {
      const date = new Date(`${value}T00:00:00Z`);
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        res.status(400).json({ error: "Choose valid calendar dates." }); return;
      }
    }
  }
  if (q.fromDate && q.toDate && q.fromDate > q.toDate) {
    res.status(400).json({ error: "Start date must be before end date." }); return;
  }
  const end = q.toDate ? new Date(`${q.toDate}T00:00:00Z`) : undefined;
  end?.setUTCDate(end.getUTCDate() + 1);
  const rows = await db.select(submissionSelection).from(submissionsTable)
    .innerJoin(usersTable, eq(usersTable.id, submissionsTable.userId)).where(and(
      q.permitNumber ? ilike(submissionsTable.permitNumber, `%${q.permitNumber}%`) : undefined,
      q.address ? ilike(submissionsTable.address, `%${q.address}%`) : undefined,
      q.resident ? ilike(usersTable.username, `%${q.resident}%`) : undefined,
      q.status ? eq(submissionsTable.status, q.status) : undefined,
      q.fromDate ? gte(submissionsTable.createdAt, new Date(`${q.fromDate}T00:00:00Z`)) : undefined,
      end ? lt(submissionsTable.createdAt, end) : undefined,
    )).orderBy(desc(submissionsTable.createdAt));
  res.json(ListStaffSubmissionsResponse.parse(rows));
});
router.patch("/staff/submissions/:id", async (req, res): Promise<void> => {
  const params = UpdateSubmissionReviewParams.safeParse(req.params);
  const input = UpdateSubmissionReviewBody.strict().safeParse(req.body);
  if (!params.success || !input.success) { res.status(400).json({ error: "Invalid review update." }); return; }
  const row = await db.transaction(async (tx) => {
    const [updated] = await tx.update(submissionsTable).set({
      ...input.data, updatedAt: new Date(),
    }).where(eq(submissionsTable.id, params.data.id)).returning();
    if (!updated) return undefined;
    await tx.insert(notificationsTable).values({
      userId: updated.userId, message: `Staff review for "${updated.subject}": ${updated.status.replaceAll("_", " ")}.`,
    });
    const [user] = await tx.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, updated.userId));
    return { ...updated, resident: user.username };
  });
  if (!row) { res.status(404).json({ error: "Submission not found." }); return; }
  res.json(UpdateSubmissionReviewResponse.parse(row));
});
router.get("/staff/submissions/:id/notes", async (req, res): Promise<void> => {
  const params = ListStaffNotesParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid submission." }); return; }
  const notes = await db.select({
    id: staffNotesTable.id, body: staffNotesTable.body, author: usersTable.username, createdAt: staffNotesTable.createdAt,
  }).from(staffNotesTable).innerJoin(usersTable, eq(usersTable.id, staffNotesTable.authorId))
    .where(eq(staffNotesTable.submissionId, params.data.id)).orderBy(desc(staffNotesTable.createdAt));
  res.json(ListStaffNotesResponse.parse(notes));
});
router.post("/staff/submissions/:id/notes", async (req, res): Promise<void> => {
  const params = AddStaffNoteParams.safeParse(req.params);
  const input = AddStaffNoteBody.strict().safeParse(req.body);
  if (!params.success || !input.success || !input.data.body.trim()) { res.status(400).json({ error: "Enter a note." }); return; }
  const [submission] = await db.select({ id: submissionsTable.id }).from(submissionsTable).where(eq(submissionsTable.id, params.data.id));
  if (!submission) { res.status(404).json({ error: "Submission not found." }); return; }
  const [note] = await db.insert(staffNotesTable).values({
    submissionId: params.data.id, authorId: req.authUser!.id, body: input.data.body.trim(),
  }).returning();
  res.status(201).json(AddStaffNoteResponse.parse({ ...note, author: req.authUser!.username }));
});
router.post("/staff/accounts", async (req, res): Promise<void> => {
  const input = CreateStaffAccountBody.strict().safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "Use a valid username and a password of 8–128 characters." }); return; }
  const [exists] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, input.data.username));
  if (exists) { res.status(409).json({ error: "That username is already taken." }); return; }
  try {
    const [user] = await db.insert(usersTable).values({
      username: input.data.username, passwordHash: await bcrypt.hash(input.data.password, 12), role: "city_staff_admin",
    }).returning();
    res.status(201).json(CreateStaffAccountResponse.parse(user));
  } catch (error) {
    if (typeof error === "object" && error !== null && "cause" in error &&
      typeof error.cause === "object" && error.cause !== null && "code" in error.cause && error.cause.code === "23505") {
      res.status(409).json({ error: "That username is already taken." }); return;
    }
    throw error;
  }
});
export default router;