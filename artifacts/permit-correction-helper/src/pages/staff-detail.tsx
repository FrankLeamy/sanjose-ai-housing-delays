import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  useGetSubmission, useListStaffNotes, useUpdateSubmissionReview, useAddStaffNote,
  getGetSubmissionQueryKey, getListStaffNotesQueryKey, getListStaffSubmissionsQueryKey, getListSubmissionsQueryKey,
  type ReviewStatus,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PageShell, ErrorPanel, ListSkeleton, STATUS_LABELS } from "@/components/submission-ui";
import { SubmissionBody } from "@/components/submission-body";
import { errorMessage } from "@/lib/documents";

export default function StaffDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const valid = Number.isInteger(id) && id > 0;
  const qc = useQueryClient();
  // This page is only rendered for staff (route gate), so notes are staff-only.
  const q = useGetSubmission(id, { query: { queryKey: getGetSubmissionQueryKey(id), enabled: valid } });
  const notes = useListStaffNotes(id, { query: { queryKey: getListStaffNotesQueryKey(id), enabled: valid } });
  const review = useUpdateSubmissionReview();
  const addNote = useAddStaffNote();
  const [status, setStatus] = useState<ReviewStatus>("submitted");
  const [reviewMessage, setReviewMessage] = useState("");
  const [loadedFor, setLoadedFor] = useState<number | null>(null);
  const [reviewMsg, setReviewMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [noteError, setNoteError] = useState("");

  useEffect(() => { document.title = "Staff review | Permit Correction Helper"; }, []);
  useEffect(() => {
    if (q.data && loadedFor !== q.data.id) {
      setLoadedFor(q.data.id);
      setStatus(q.data.status);
      setReviewMessage(q.data.reviewMessage);
    }
  }, [q.data, loadedFor]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewMsg(null);
    try {
      await review.mutateAsync({ id, data: { status, reviewMessage } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: getGetSubmissionQueryKey(id) }),
        qc.invalidateQueries({ queryKey: getListStaffSubmissionsQueryKey() }),
        qc.invalidateQueries({ queryKey: getListSubmissionsQueryKey() }),
      ]);
      setReviewMsg({ ok: true, text: "Review saved. The resident can see the status and message." });
    } catch (err) {
      setReviewMsg({ ok: false, text: errorMessage(err) });
    }
  };

  const saveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setNoteError("");
    if (!noteBody.trim()) { setNoteError("Write a note first."); return; }
    try {
      await addNote.mutateAsync({ id, data: { body: noteBody.trim() } });
      setNoteBody("");
      await qc.invalidateQueries({ queryKey: getListStaffNotesQueryKey(id) });
    } catch (err) {
      setNoteError(errorMessage(err));
    }
  };

  return (
    <PageShell>
      <div className="space-y-8">
        <Link href="/staff" className="text-sm text-primary hover:underline" data-testid="link-back-queue">Back to queue</Link>
        {!valid ? <ErrorPanel error={new Error("Submission not found.")} /> : q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorPanel error={q.error} onRetry={() => q.refetch()} /> : q.data ? (
          <>
            <SubmissionBody s={q.data} showReview={false} />
            <form onSubmit={save} className="space-y-3 rounded-md border border-primary/20 bg-primary/5 p-4" data-testid="form-review">
              <h2 className="text-lg font-serif font-semibold">Review</h2>
              <p className="text-xs text-muted-foreground">Status and message are visible to the resident. They are app labels, not official permit approval.</p>
              <div className="space-y-1">
                <Label htmlFor="r-status">Status</Label>
                <select id="r-status" data-testid="select-review-status" value={status} onChange={(e) => setStatus(e.target.value as ReviewStatus)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="r-msg">Message to resident</Label>
                <Textarea id="r-msg" data-testid="input-review-message" rows={5} maxLength={10000} value={reviewMessage} onChange={(e) => setReviewMessage(e.target.value)} />
              </div>
              {reviewMsg && <p role="alert" data-testid="status-review-result" className={`text-sm ${reviewMsg.ok ? "text-accent" : "text-destructive"}`}>{reviewMsg.text}</p>}
              <Button type="submit" disabled={review.isPending} data-testid="button-save-review">{review.isPending ? "Saving..." : "Save review"}</Button>
            </form>

            <section className="space-y-3">
              <h2 className="text-lg font-serif font-semibold">Private staff notes</h2>
              <p className="text-xs text-muted-foreground">Never shown to residents.</p>
              {notes.isLoading ? <ListSkeleton /> : notes.isError ? <ErrorPanel error={notes.error} onRetry={() => notes.refetch()} /> : !notes.data || notes.data.length === 0 ? (
                <div data-testid="text-no-notes" className="rounded-md bg-muted/30 p-6 text-center text-sm text-muted-foreground">No notes yet.</div>
              ) : notes.data.map((n) => (
                <div key={n.id} data-testid={`note-${n.id}`} className="rounded-md border border-border bg-card p-3 text-sm">
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{n.author} / {format(new Date(n.createdAt), "MMM d, yyyy h:mm a")}</p>
                </div>
              ))}
              <form onSubmit={saveNote} className="space-y-2">
                <Label htmlFor="n-body">Add note</Label>
                <Textarea id="n-body" data-testid="input-note" rows={3} maxLength={10000} value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
                {noteError && <p role="alert" data-testid="status-note-error" className="text-sm text-destructive">{noteError}</p>}
                <Button type="submit" variant="outline" disabled={addNote.isPending} data-testid="button-add-note">{addNote.isPending ? "Adding..." : "Add note"}</Button>
              </form>
            </section>
          </>
        ) : null}
      </div>
    </PageShell>
  );
}
