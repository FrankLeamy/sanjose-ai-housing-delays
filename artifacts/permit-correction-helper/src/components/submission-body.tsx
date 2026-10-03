import { format } from "date-fns";
import { Download } from "lucide-react";
import { Link } from "wouter";
import { useGetMe, getGetMeQueryKey, type SubmissionDetail } from "@workspace/api-client-react";
import { isStaffRole } from "@/lib/roles";
import { StatusBadge, KIND_LABELS } from "@/components/submission-ui";
import { documentUrl, formatSize } from "@/lib/documents";

export function SubmissionBody({ s, showReview = true }: { s: SubmissionDetail; showReview?: boolean }) {
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const reportPrefix = isStaffRole(me?.role) ? "/staff/reports" : "/reports";
  return (
    <div className="space-y-6">
      <div className="space-y-2 border-b border-border pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={s.status} />
          <span className="text-xs text-muted-foreground">{KIND_LABELS[s.kind] ?? s.kind}</span>
        </div>
        <h1 data-testid="text-subject" className="text-3xl font-serif font-bold">{s.subject}</h1>
        <p className="text-xs text-muted-foreground">
          From {s.resident} / Sent {format(new Date(s.createdAt), "MMM d, yyyy h:mm a")} / Updated {format(new Date(s.updatedAt), "MMM d, yyyy h:mm a")}
        </p>
        {(s.permitNumber || s.address) && (
          <p className="text-sm">{s.permitNumber && <span>Permit {s.permitNumber}</span>}{s.permitNumber && s.address ? " / " : ""}{s.address}</p>
        )}
      </div>
      <p data-testid="text-message" className="whitespace-pre-wrap text-sm leading-relaxed">{s.message}</p>

      <section className="space-y-2">
        <h2 className="text-lg font-serif font-semibold">Documents</h2>
        {s.documents.length === 0 ? <p className="text-sm text-muted-foreground">No documents attached.</p> : s.documents.map((d) => (
          <a key={d.id} href={documentUrl(d.id)} download={d.name} data-testid={`link-document-${d.id}`} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted/40">
            <span className="truncate">{d.name} <span className="text-muted-foreground">({formatSize(d.size)})</span></span>
            <Download className="w-4 h-4 text-primary shrink-0" />
          </a>
        ))}
      </section>

      {showReview && (
        <section className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-4">
          <h2 className="text-lg font-serif font-semibold">City review</h2>
          <p className="text-xs text-muted-foreground">This status is an app review label, not an official permit approval.</p>
          <p className="text-sm font-medium" data-testid="text-review-status">{`Status: ${s.status.replace(/_/g, " ")}`}</p>
          <p data-testid="text-review-message" className="whitespace-pre-wrap text-sm">{s.reviewMessage || "No message from City staff yet."}</p>
        </section>
      )}

      {s.report && (
        <section className="space-y-2">
          <h2 className="text-lg font-serif font-semibold">Linked report</h2>
          <Link href={`${reportPrefix}/${s.report.id}`} data-testid="link-linked-report" className="block rounded-md border border-border bg-card p-4 hover:bg-muted/40">
            <p className="font-medium">{s.report.address}</p>
            <p className="text-sm text-muted-foreground mt-1">{s.report.summary}</p>
            <p className="text-xs text-primary mt-2">Open report ({s.report.items.length} items)</p>
          </Link>
        </section>
      )}
      {s.question && (
        <section className="space-y-2">
          <h2 className="text-lg font-serif font-semibold">Linked question</h2>
          <div data-testid="text-linked-question" className="rounded-md border border-border bg-card p-4 space-y-2 text-sm">
            <p className="font-medium whitespace-pre-wrap">{s.question.question}</p>
            <p className="text-muted-foreground whitespace-pre-wrap">{s.question.response}</p>
          </div>
        </section>
      )}
    </div>
  );
}
