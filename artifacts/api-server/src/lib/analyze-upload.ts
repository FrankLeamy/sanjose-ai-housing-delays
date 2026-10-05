import { extractText, getDocumentProxy } from "unpdf";
import { storage } from "./submission-service";
import { screenDocumentPages, unreadableDocument, type ScreeningDraft } from "./document-screening";

type UploadedDocument = { name: string; contentType: string; objectPath: string; generation: string | null };
export async function analyzeUploadedDocument(document: UploadedDocument): Promise<ScreeningDraft> {
  if (document.contentType !== "application/pdf") return unreadableDocument(document.name);
  const file = await storage.getObjectEntityFile(document.objectPath);
  const version = file.bucket.file(file.name, { generation: document.generation ?? undefined });
  const [bytes] = await version.download();
  // Read the same immutable version validated by prepareDocuments.
  return screenPdfBytes(new Uint8Array(bytes), document.name);
}

export async function screenPdfBytes(bytes: Uint8Array, name: string): Promise<ScreeningDraft> {
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | undefined;
  try {
    pdf = await getDocumentProxy(bytes);
    if (pdf.numPages > 100) return unreadableDocument(name);
    const result = await extractText(pdf, { mergePages: false });
    return screenDocumentPages(result.text, name);
  } catch {
    // Corrupt, encrypted, scanned or unsupported documents must never look approved.
    return unreadableDocument(name);
  } finally {
    await pdf?.loadingTask.destroy();
  }
}