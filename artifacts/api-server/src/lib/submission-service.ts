import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, documentsTable, submissionsTable } from "@workspace/db";
import { ObjectNotFoundError, ObjectStorageService } from "./objectStorage";

export const storage = new ObjectStorageService();
export class SubmissionInputError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DocumentRow = typeof documentsTable.$inferSelect;

export async function prepareDocuments(ids: string[], userId: number): Promise<DocumentRow[]> {
  if (ids.length === 0) return [];
  if (new Set(ids).size !== ids.length || ids.length > 10) {
    throw new SubmissionInputError("Choose up to 10 distinct documents.");
  }
  const documents = await db.select().from(documentsTable)
    .where(and(inArray(documentsTable.id, ids), eq(documentsTable.userId, userId), isNull(documentsTable.submissionId)));
  if (documents.length !== ids.length) throw new SubmissionInputError("Unauthorized access", 403);
  for (const document of documents) {
    try {
      const file = await storage.getObjectEntityFile(document.objectPath);
      const [metadata] = await file.getMetadata();
      if (Number(metadata.size) !== document.size || metadata.contentType !== document.contentType) {
        throw new SubmissionInputError("Uploaded file does not match its declared size or type.");
      }
      const version = file.bucket.file(file.name, { generation: metadata.generation });
      const [header] = await version.download({ start: 0, end: 7 });
      const valid = document.contentType === "application/pdf"
        ? header.subarray(0, 5).toString() === "%PDF-"
        : document.contentType === "image/png"
          ? header.toString("hex") === "89504e470d0a1a0a"
          : header.subarray(0, 3).toString("hex") === "ffd8ff";
      if (!valid) throw new SubmissionInputError("File contents must be a PDF, PNG, or JPG.");
      document.generation = String(metadata.generation);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) throw new SubmissionInputError("Finish uploading your document before submitting.");
      throw error;
    }
  }
  return documents;
}

export async function saveSubmission(
  tx: Transaction,
  values: typeof submissionsTable.$inferInsert,
  documents: DocumentRow[] = [],
) {
  const [submission] = await tx.insert(submissionsTable).values(values).returning();
  for (const document of documents) {
    const updated = await tx.update(documentsTable).set({
      submissionId: submission.id, generation: document.generation,
    }).where(and(eq(documentsTable.id, document.id), eq(documentsTable.userId, values.userId), isNull(documentsTable.submissionId)))
      .returning({ id: documentsTable.id });
    if (updated.length !== 1) throw new SubmissionInputError("This document has already been submitted.");
  }
  return submission;
}