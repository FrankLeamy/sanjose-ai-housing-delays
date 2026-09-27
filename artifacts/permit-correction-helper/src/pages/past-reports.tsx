import { useEffect } from "react";
import { format } from "date-fns";
import { ArrowRight, CalendarDays, ChevronRight, FileText, FolderOpen, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { useListReports } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TopNav } from "@/pages/home";
import { sanJosePermits } from "@/data/san-jose-permits";

function readableDate(date: string) {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? "Date unavailable" : format(parsed, "MMM d, yyyy");
}

export default function PastReportsPage() {
  const { data: reports, isLoading, isError, refetch, isFetching } = useListReports();
  const sortedReports = reports ? [...reports].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : [];

  useEffect(() => {
    document.title = "Past reports | Permit Correction Helper";
  }, []);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <TopNav />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-9 sm:px-8 md:pt-14">
        <div className="mb-9 flex flex-col gap-5 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Your workspace
            </div>
            <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Past reports</h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
              Find a previous correction letter and pick up where you left off.
            </p>
          </div>
          <Link href="/" data-testid="link-new-report" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            New report <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {isLoading ? (
          <div aria-label="Loading reports" className="space-y-3">
            <Skeleton className="h-4 w-28 mb-6" />
            {[0, 1, 2].map((item) => (
              <div key={item} className="rounded-lg border border-border bg-card p-5 sm:p-6">
                <Skeleton className="mb-4 h-3 w-28" />
                <Skeleton className="mb-3 h-6 w-2/3" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-destructive/20 bg-card px-6 py-12 text-center sm:py-16">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive"><FileText className="h-6 w-6" /></div>
            <h2 className="font-serif text-2xl font-semibold">We couldn't load your reports.</h2>
            <p data-testid="status-reports-error" className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">Your saved work is still here. Check your connection and try again.</p>
            <Button data-testid="button-retry-reports" type="button" variant="outline" disabled={isFetching} onClick={() => refetch()} className="mt-6 gap-2">
              <RefreshCw className="h-4 w-4" /> {isFetching ? "Trying again…" : "Try again"}
            </Button>
          </div>
        ) : sortedReports.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/60 px-6 py-14 text-center sm:py-20">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-xl border border-primary/10 bg-primary/5 text-primary"><FolderOpen className="h-8 w-8" strokeWidth={1.5} /></div>
            <h2 data-testid="text-empty-reports" className="font-serif text-2xl font-semibold sm:text-3xl">A fresh start.</h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">When you analyze a correction letter, its report will be saved here for you to revisit.</p>
            <Link href="/" data-testid="link-create-first-report" className="mt-7 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
              Analyze a letter <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <section aria-label="Saved reports">
            <div className="mb-4 flex items-center justify-between">
              <p data-testid="text-report-count" className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {sortedReports.length} saved {sortedReports.length === 1 ? "report" : "reports"}
              </p>
              <p className="text-xs text-muted-foreground">Newest first</p>
            </div>
            <div className="space-y-3">
              {sortedReports.map((report, index) => {
                const outstanding = report.items.filter((item) => item.status === "needs_fix" && !item.completed).length;
                return (
                  <Link key={report.id} href={`/reports/${report.id}`} data-testid={`link-report-${report.id}`} className="group block rounded-lg border border-card-border bg-card p-5 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_10px_28px_-20px_hsl(var(--primary)/0.3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:p-6">
                    <div className="flex items-start gap-4">
                      <div className="mt-0.5 hidden h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/5 text-primary sm:flex"><FileText className="h-5 w-5" strokeWidth={1.7} /></div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> <time dateTime={report.createdAt} data-testid={`text-report-date-${report.id}`}>{readableDate(report.createdAt)}</time></span>
                          {index === 0 && <span className="rounded-sm bg-secondary/60 px-2 py-0.5 font-semibold text-secondary-foreground">Most recent</span>}
                        </div>
                        <h2 data-testid={`text-report-address-${report.id}`} className="truncate font-serif text-xl font-semibold leading-snug text-foreground transition-colors group-hover:text-primary sm:text-2xl">{report.address || `Report #${report.id}`}</h2>
                        <p data-testid={`text-report-summary-${report.id}`} className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{report.summary || "Open this report to review its correction checklist."}</p>
                        <div className="mt-4 flex items-center gap-3 text-xs">
                          <span className="font-medium text-primary">{report.items.length} {report.items.length === 1 ? "item" : "items"}</span>
                          <span className="h-1 w-1 rounded-full bg-border" />
                          <span className={outstanding > 0 ? "text-muted-foreground" : "text-accent"}>{outstanding > 0 ? `${outstanding} to address` : "All addressed"}</span>
                        </div>
                      </div>
                      <ChevronRight className="mt-6 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section aria-label="City of San José residential permits" className="mt-14 border-t border-border pt-9">
          <div className="mb-6">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              City of San José open data · {sanJosePermits.length} records
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold">Residential permit records</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Public records from the City’s Active Building Permits dataset, separate from your own reports.
              Status may have changed since publication. The City lists issue dates for these records,
              but does not publish application or approval dates, correction issues, or required next steps here.
            </p>
          </div>
          <div className="space-y-3">
            {sanJosePermits.map((permit) => (
              <article key={permit.permitNumber} className="rounded-lg border border-card-border bg-card p-5 sm:p-6">
                <p className="text-xs text-muted-foreground">{permit.permitNumber} · {permit.housingType}</p>
                <h3 className="mt-2 font-serif text-xl font-semibold">{permit.address}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{permit.projectDescription}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {permit.permitType} · Status at publication: {permit.status} · Issued: {permit.issuedDate}
                </p>
                <a href={permit.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline">
                  View official City record for {permit.permitNumber}
                </a>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}