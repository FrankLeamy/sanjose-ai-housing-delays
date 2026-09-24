import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { TopNav, ReportView } from "@/pages/home";
import { Button } from "@/components/ui/button";

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const reportId = Number(id);

  useEffect(() => {
    document.title = "Correction report | Permit Correction Helper";
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />
      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8">
        {Number.isSafeInteger(reportId) && reportId > 0 ? (
          <ReportView reportId={reportId} onReset={() => setLocation("/reports")} />
        ) : (
          <div className="py-20 text-center">
            <p className="text-destructive font-medium mb-4">Report not found.</p>
            <Button variant="outline" onClick={() => setLocation("/reports")}>Past reports</Button>
          </div>
        )}
      </main>
    </div>
  );
}