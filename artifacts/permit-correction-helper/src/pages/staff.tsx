import { useEffect, useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useListStaffSubmissions, type ListStaffSubmissionsParams, type ReviewStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageShell, StatusBadge, ErrorPanel, ListSkeleton, KIND_LABELS, STATUS_LABELS } from "@/components/submission-ui";

const empty = { permitNumber: "", address: "", resident: "", status: "", fromDate: "", toDate: "" };

export default function StaffPage() {
  const [draft, setDraft] = useState(empty);
  const [applied, setApplied] = useState<ListStaffSubmissionsParams>({});
  const q = useListStaffSubmissions(applied);
  useEffect(() => { document.title = "Staff review | Permit Correction Helper"; }, []);

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const p: ListStaffSubmissionsParams = {};
    if (draft.permitNumber.trim()) p.permitNumber = draft.permitNumber.trim();
    if (draft.address.trim()) p.address = draft.address.trim();
    if (draft.resident.trim()) p.resident = draft.resident.trim();
    if (draft.status) p.status = draft.status as ReviewStatus;
    if (draft.fromDate) p.fromDate = draft.fromDate;
    if (draft.toDate) p.toDate = draft.toDate;
    setApplied(p);
  };
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft({ ...draft, [k]: e.target.value });

  return (
    <PageShell>
      <div className="space-y-6">
        <div className="space-y-2 border-b border-border pb-6">
          <h1 className="text-3xl font-serif font-bold">Staff review queue</h1>
          <p className="text-sm text-muted-foreground">Review labels are internal to this app and are not official permit approvals.</p>
        </div>
        <form onSubmit={apply} className="grid gap-3 md:grid-cols-3" data-testid="form-filters">
          <div className="space-y-1"><Label htmlFor="f-permit">Permit number</Label><Input id="f-permit" data-testid="input-filter-permit" maxLength={100} value={draft.permitNumber} onChange={set("permitNumber")} /></div>
          <div className="space-y-1"><Label htmlFor="f-address">Address</Label><Input id="f-address" data-testid="input-filter-address" maxLength={300} value={draft.address} onChange={set("address")} /></div>
          <div className="space-y-1"><Label htmlFor="f-resident">Resident</Label><Input id="f-resident" data-testid="input-filter-resident" maxLength={30} value={draft.resident} onChange={set("resident")} /></div>
          <div className="space-y-1"><Label htmlFor="f-status">Status</Label>
            <select id="f-status" data-testid="select-filter-status" value={draft.status} onChange={set("status")} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="space-y-1"><Label htmlFor="f-from">From date</Label><Input id="f-from" type="date" data-testid="input-filter-from" value={draft.fromDate} onChange={set("fromDate")} /></div>
          <div className="space-y-1"><Label htmlFor="f-to">To date</Label><Input id="f-to" type="date" data-testid="input-filter-to" value={draft.toDate} onChange={set("toDate")} /></div>
          <div className="flex gap-2 md:col-span-3">
            <Button type="submit" data-testid="button-apply-filters">Apply filters</Button>
            <Button type="button" variant="outline" data-testid="button-clear-filters" onClick={() => { setDraft(empty); setApplied({}); }}>Clear</Button>
          </div>
          <p className="text-xs text-muted-foreground md:col-span-3">Date filters use UTC and include both selected dates.</p>
        </form>
        <section className="space-y-3" aria-live="polite">
          {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorPanel error={q.error} onRetry={() => q.refetch()} /> : !q.data || q.data.length === 0 ? (
            <div data-testid="text-empty" className="rounded-md bg-muted/30 p-8 text-center text-sm text-muted-foreground">No submissions match these filters.</div>
          ) : (
            <>
              {q.isFetching && <p className="text-xs text-muted-foreground">Refreshing...</p>}
              {q.data.map((s) => (
                <Link key={s.id} href={`/staff/submissions/${s.id}`} data-testid={`link-staff-submission-${s.id}`} className="block rounded-md border border-border bg-card p-4 hover:bg-muted/40 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{s.subject}</span><StatusBadge status={s.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.resident} / {KIND_LABELS[s.kind] ?? s.kind}{s.permitNumber ? ` / ${s.permitNumber}` : ""}{s.address ? ` / ${s.address}` : ""} / {format(new Date(s.createdAt), "MMM d, yyyy")}
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
