import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { TopNav } from "@/pages/home";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/documents";

export const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  in_review: "In review",
  changes_requested: "Changes requested",
  review_complete: "Review complete",
};
export const KIND_LABELS: Record<string, string> = {
  permit: "Permit",
  correction: "Correction",
  question: "Question",
  report: "Report",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant="outline" data-testid={`status-${status}`} className="bg-primary/5 text-primary border-primary/20">{STATUS_LABELS[status] ?? status}</Badge>;
}

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />
      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8">{children}</main>
    </div>
  );
}

export function ErrorPanel({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" data-testid="status-error" className="rounded-md border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive flex items-start gap-3">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1">{errorMessage(error)}</div>
      {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function ListSkeleton() {
  return <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>;
}

export function Unauthorized() {
  return (
    <PageShell>
      <div role="alert" data-testid="text-unauthorized" className="py-20 text-center space-y-2">
        <h1 className="text-2xl font-serif font-semibold text-destructive">Unauthorized access</h1>
        <p className="text-muted-foreground text-sm">Unauthorized access</p>
      </div>
    </PageShell>
  );
}
