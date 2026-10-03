import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, documentsTable, permitQuestionsTable, reportsTable, submissionsTable, usersTable } from "@workspace/db";
import { CreateSubmissionBody, CreateSubmissionResponse, GetSubmissionParams, GetSubmissionResponse, ListSubmissionsResponse } from "@workspace/api-zod";
import { prepareDocuments, saveSubmission, SubmissionInputError } from "../lib/submission-service";

export const submissionSelection = {
  id: submissionsTable.id, kind: submissionsTable.kind, subject: submissionsTable.subject,
  message: submissionsTable.message, permitNumber: submissionsTable.permitNumber,
  address: submissionsTable.address, status: submissionsTable.status,
  reviewMessage: submissionsTable.reviewMessage, createdAt: submissionsTable.createdAt,
  updatedAt: submissionsTable.updatedAt, resident: usersTable.username,
};
const router: IRouter = Router();

router.get("/submissions", async (req, res): Promise<void> => {
  const rows = await db.select(submissionSelection).from(submissionsTable)
    .innerJoin(usersTable, eq(usersTable.id, submissionsTable.userId))
    .where(eq(submissionsTable.userId, req.authUser!.id)).orderBy(desc(submissionsTable.createdAt));
  res.json(ListSubmissionsResponse.parse(rows));
});
router.post("/submissions", async (req, res): Promise<void> => {
  const input = CreateSubmissionBody.strict().safeParse(req.body);
  if (!input.success || !input.data.subject.trim() || !input.data.message.trim()) {
    res.status(400).json({ error: "Enter a subject and message, and choose a valid submission type." }); return;
  }
  try {
    const documents = await prepareDocuments(input.data.documentIds ?? [], req.authUser!.id);
    const { documentIds: _ids, ...data } = input.data;
    const row = await db.transaction((tx) => saveSubmission(tx, {
      ...data, subject: data.subject.trim(), message: data.message.trim(), userId: req.authUser!.id,
    }, documents));
    res.status(201).json(CreateSubmissionResponse.parse({ ...row, resident: req.authUser!.username }));
  } catch (error) {
    if (error instanceof SubmissionInputError) { res.status(error.status).json({ error: error.message }); return; }
    throw error;
  }
});
router.get("/submissions/:id", async (req, res): Promise<void> => {
  const params = GetSubmissionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid submission." }); return; }
  const [row] = await db.select({
    ...submissionSelection, userId: submissionsTable.userId,
    reportId: submissionsTable.reportId, questionId: submissionsTable.questionId,
  }).from(submissionsTable).innerJoin(usersTable, eq(usersTable.id, submissionsTable.userId))
    .where(and(eq(submissionsTable.id, params.data.id),
      req.authUser!.role === "city_staff_admin" ? undefined : eq(submissionsTable.userId, req.authUser!.id)));
  if (!row) { res.status(403).json({ error: "Unauthorized access" }); return; }
  const documents = await db.select({
    id: documentsTable.id, name: documentsTable.name, contentType: documentsTable.contentType, size: documentsTable.size,
  }).from(documentsTable).where(and(eq(documentsTable.submissionId, row.id), eq(documentsTable.userId, row.userId)));
  const [report] = row.reportId
    ? await db.select().from(reportsTable).where(and(eq(reportsTable.id, row.reportId), eq(reportsTable.userId, row.userId))) : [];
  const [question] = row.questionId
    ? await db.select().from(permitQuestionsTable).where(and(eq(permitQuestionsTable.id, row.questionId), eq(permitQuestionsTable.userId, row.userId))) : [];
  res.json(GetSubmissionResponse.parse({ ...row, documents, report: report ?? null, question: question ?? null }));
});
export default router;