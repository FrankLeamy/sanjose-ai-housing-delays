import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Paperclip, X } from "lucide-react";
import {
  useListSubmissions,
  useCreateSubmission,
  getListSubmissionsQueryKey,
  getListStaffSubmissionsQueryKey,
  SubmissionInputKind,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageShell, StatusBadge, ErrorPanel, ListSkeleton, KIND_LABELS } from "@/components/submission-ui";
import { errorMessage, formatSize, useDocumentUpload, validateDocument } from "@/lib/documents";

export default function SubmissionsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const list = useListSubmissions();
  const create = useCreateSubmission();
  const upload = useDocumentUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<SubmissionInputKind>("permit");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [permitNumber, setPermitNumber] = useState("");
  const [address, setAddress] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = "Submissions | Permit Correction Helper"; }, []);

  const addFiles = (picked: FileList | null) => {
    if (!picked) return;
    const next = [...files];
    for (const f of Array.from(picked)) {
      const problem = validateDocument(f);
      if (problem) { setError(problem); continue; }
      if (next.length >= 10) { setError("You can attach up to 10 documents."); break; }
      next.push(f);
    }
    setFiles(next);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!subject.trim() || !message.trim()) { setError("Subject and message are required."); return; }
    setBusy(true);
    try {
      const documentIds: string[] = [];
      for (const f of files) documentIds.push(await upload(f));
      const created = await create.mutateAsync({
        data: {
          kind,
          subject: subject.trim(),
          message: message.trim(),
          ...(permitNumber.trim() ? { permitNumber: permitNumber.trim() } : {}),
          ...(address.trim() ? { address: address.trim() } : {}),
          ...(documentIds.length ? { documentIds } : {}),
        },
      });
      await queryClient.invalidateQueries({ queryKey: getListSubmissionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListStaffSubmissionsQueryKey() });
      setLocation(`/submissions/${created.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell>
      <div className="space-y-8">
        <div className="space-y-2 border-b border-border pb-6">
          <h1 className="text-3xl font-serif font-bold">Submissions</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Send City staff a permit request, a correction response, or a question. Review statuses here are labels for this app only, not an official permit approval.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif">New request</CardTitle>
            <CardDescription>Attach up to 10 PDF, PNG, or JPG documents, 10MB each.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="kind">Type</Label>
                  <select id="kind" data-testid="select-kind" value={kind} onChange={(e) => setKind(e.target.value as SubmissionInputKind)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="permit">Permit request</option>
                    <option value="correction">Correction response</option>
                    <option value="question">Question</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" data-testid="input-subject" maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="permitNumber">Permit number (optional)</Label>
                  <Input id="permitNumber" data-testid="input-permit-number" maxLength={100} value={permitNumber} onChange={(e) => setPermitNumber(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address">Address (optional)</Label>
                  <Input id="address" data-testid="input-address" maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" data-testid="input-message" rows={5} maxLength={10000} value={message} onChange={(e) => setMessage(e.target.value)} />
              </div>
              <div className="space-y-2">
                <input ref={fileRef} type="file" multiple className="hidden" accept="application/pdf,image/png,image/jpeg" onChange={(e) => addFiles(e.target.files)} data-testid="input-documents" />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={files.length >= 10 || busy} data-testid="button-add-documents">
                  <Paperclip className="w-4 h-4 mr-2" /> Attach documents ({files.length}/10)
                </Button>
                {files.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                    <span className="truncate">{f.name} <span className="text-muted-foreground">({formatSize(f.size)})</span></span>
                    <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))} disabled={busy}><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              {error && <p role="alert" data-testid="status-submit-error" className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={busy} data-testid="button-submit-request">{busy ? "Sending..." : "Send request"}</Button>
            </form>
          </CardContent>
        </Card>

        <section className="space-y-3" aria-live="polite">
          <h2 className="text-xl font-serif font-semibold">Your submissions</h2>
          {list.isLoading ? <ListSkeleton /> : list.isError ? <ErrorPanel error={list.error} onRetry={() => list.refetch()} /> : !list.data || list.data.length === 0 ? (
            <div data-testid="text-empty" className="rounded-md bg-muted/30 p-8 text-center text-sm text-muted-foreground">You have not sent any submissions yet.</div>
          ) : (
            <>
              {list.isFetching && <p className="text-xs text-muted-foreground">Refreshing...</p>}
              {list.data.map((s) => (
                <Link key={s.id} href={`/submissions/${s.id}`} data-testid={`link-submission-${s.id}`} className="block rounded-md border border-border bg-card p-4 hover:bg-muted/40 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{s.subject}</span>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {KIND_LABELS[s.kind] ?? s.kind}{s.permitNumber ? ` / ${s.permitNumber}` : ""}{s.address ? ` / ${s.address}` : ""} / {format(new Date(s.createdAt), "MMM d, yyyy")}
                  </p>
                </Link>
              ))}
            </>
          )}
        </section>
      </div>
    </PageShell>
  );
}
