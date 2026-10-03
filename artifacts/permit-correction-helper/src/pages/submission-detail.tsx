import { useEffect } from "react";
import { Link, useParams } from "wouter";
import { useGetMe, useGetSubmission, getGetMeQueryKey, getGetSubmissionQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { PageShell, ErrorPanel, ListSkeleton } from "@/components/submission-ui";
import { SubmissionBody } from "@/components/submission-body";

export default function SubmissionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const valid = Number.isInteger(id) && id > 0;
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const q = useGetSubmission(id, { query: { queryKey: getGetSubmissionQueryKey(id), enabled: valid } });
  useEffect(() => { document.title = "Submission | Permit Correction Helper"; }, []);
  const isStaff = me?.role === "city_staff_admin";

  return (
    <PageShell>
      <div className="space-y-6">
        <Link href={isStaff ? "/staff" : "/submissions"} className="text-sm text-primary hover:underline" data-testid="link-back">Back to {isStaff ? "queue" : "submissions"}</Link>
        {!valid ? <ErrorPanel error={new Error("Submission not found.")} /> : q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorPanel error={q.error} onRetry={() => q.refetch()} /> : q.data ? (
          <>
            <SubmissionBody s={q.data} />
            {isStaff && <Link href={`/staff/submissions/${q.data.id}`} data-testid="link-staff-review"><Button variant="outline">Open staff review</Button></Link>}
          </>
        ) : null}
      </div>
    </PageShell>
  );
}
