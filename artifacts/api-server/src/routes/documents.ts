import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, documentsTable } from "@workspace/db";
import { DownloadDocumentParams, RequestDocumentUploadBody, RequestDocumentUploadResponse } from "@workspace/api-zod";
import { ObjectNotFoundError } from "../lib/objectStorage";
import { storage } from "../lib/submission-service";
import { isStaffRole } from "../lib/roles";

const router: IRouter = Router();
router.post("/documents/upload-url", async (req, res): Promise<void> => {
  const input = RequestDocumentUploadBody.strict().safeParse(req.body);
  if (!input.success || /[\x00-\x1f\x7f/\\]/.test(input.data.name)) {
    res.status(400).json({ error: "Choose a PDF, PNG, or JPG up to 10 MB with a valid filename." });
    return;
  }
  const uploadURL = await storage.getObjectEntityUploadURL();
  const id = randomUUID();
  await db.insert(documentsTable).values({
    id, userId: req.authUser!.id, ...input.data,
    objectPath: storage.normalizeObjectEntityPath(uploadURL),
  });
  res.status(201).json(RequestDocumentUploadResponse.parse({ id, uploadURL }));
});

router.get("/documents/:id", async (req, res): Promise<void> => {
  const params = DownloadDocumentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid document." }); return; }
  const [document] = await db.select().from(documentsTable).where(and(
    eq(documentsTable.id, params.data.id),
    isStaffRole(req.authUser!.role) ? undefined : eq(documentsTable.userId, req.authUser!.id),
  ));
  if (!document) { res.status(403).json({ error: "Unauthorized access" }); return; }
  if (!document.generation) { res.status(404).json({ error: "Document has not been submitted." }); return; }
  try {
    const file = await storage.getObjectEntityFile(document.objectPath);
    const version = file.bucket.file(file.name, { generation: document.generation });
    const [exists] = await version.exists();
    if (!exists) { res.status(404).json({ error: "Document is unavailable." }); return; }
    res.set({
      "Content-Type": document.contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(document.name).replace(/'/g, "%27")}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    await pipeline(version.createReadStream(), res);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) { res.status(404).json({ error: "Document is unavailable." }); return; }
    throw error;
  }
});
export default router;