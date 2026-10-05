import { getGetPublicPermitDetailsQueryKey, useGetPublicPermitDetails } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/documents";
import { readablePermitDate } from "@/lib/permit-format";

export function PermitDetailsDialog({ permitNumber, onClose }: { permitNumber: string; onClose: () => void }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useGetPublicPermitDetails(permitNumber, {
    query: { queryKey: getGetPublicPermitDetailsQueryKey(permitNumber), retry: false, refetchOnMount: "always" },
  });
  const rows = data ? [
    ["Permit number", data.permitNumber],
    ["Status", data.status],
    ["Address", data.address],
    ["Project description", data.projectDescription],
    ["Work description", data.workDescription],
    ["Approval status", data.approvalStatus],
    ["Issue date", readablePermitDate(data.issueDate)],
    ["Final date", readablePermitDate(data.finalDate)],
    ["Dwelling units", data.dwellingUnits?.toLocaleString("en-US")],
    ["Square footage", data.squareFootage == null ? null : `${data.squareFootage.toLocaleString("en-US")} sq ft`],
    ["Valuation", data.valuation == null ? null : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(data.valuation)],
  ] : [];
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="-translate-y-1/2 w-[calc(100%-2rem)] max-h-[85dvh] overflow-y-auto sm:max-w-2xl" data-testid="permit-details-dialog">
        <DialogHeader>
          <DialogTitle>Permit details</DialogTitle>
          <DialogDescription>{permitNumber} · City of San José public record. Private owner information is not shown.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div aria-label="Loading permit details" className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-48 w-full" /></div>
        ) : isError ? (
          <div role="alert" className="space-y-4 py-5">
            <p className="text-destructive">Permit details could not be loaded.</p>
            <p className="text-sm text-muted-foreground">{errorMessage(error)}</p>
            <Button variant="outline" disabled={isFetching} onClick={() => refetch()}>Try again</Button>
          </div>
        ) : (
          <dl className="divide-y divide-border">
            {rows.map(([label, value]) => (
              <div key={label} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
                <dt className="text-sm font-semibold">{label}</dt>
                <dd className="break-words text-sm leading-relaxed text-muted-foreground">{value || "Not available"}</dd>
              </div>
            ))}
          </dl>
        )}
      </DialogContent>
    </Dialog>
  );
}