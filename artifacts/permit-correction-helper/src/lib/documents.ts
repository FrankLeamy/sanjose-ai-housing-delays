import { useRequestDocumentUpload } from "@workspace/api-client-react";
import type { DocumentInputContentType } from "@workspace/api-client-react";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"];

export function errorMessage(error: unknown): string {
  const e = error as { status?: number; message?: string; data?: { error?: string; message?: string } | null };
  if (e?.status === 403) return "Unauthorized access";
  if (e?.status === 401) return "Your session has ended. Please log in again.";
  const detail = e?.data?.error || e?.data?.message;
  return detail || e?.message || "Something went wrong. Please try again.";
}

export function validateDocument(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return `${file.name}: only PDF, PNG, or JPG files are accepted.`;
  if (file.size < 1) return `${file.name}: file is empty.`;
  if (file.size > MAX_DOCUMENT_BYTES) return `${file.name}: file is larger than 10MB.`;
  return null;
}

export function documentUrl(id: string): string {
  return `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/documents/${encodeURIComponent(id)}`;
}

export function formatSize(n: number): string {
  return n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** Returns an async function that uploads a file directly to its signed URL and resolves to the document id. */
export function useDocumentUpload() {
  const request = useRequestDocumentUpload();
  const requestAsync = request.mutateAsync;
  return async (file: File): Promise<string> => {
    const problem = validateDocument(file);
    if (problem) throw new Error(problem);
    const { id, uploadURL } = await requestAsync({
      data: { name: file.name, size: file.size, contentType: file.type as DocumentInputContentType },
    });
    const res = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
    if (!res.ok) throw new Error(`Upload of ${file.name} failed (${res.status}).`);
    return id;
  };
}
