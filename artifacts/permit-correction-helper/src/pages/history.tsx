import { useEffect } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ArrowLeft, Clock3, MessageCircleQuestion } from "lucide-react";
import { getListPermitQuestionsQueryKey, useListPermitQuestions } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TopNav } from "@/pages/home";

export default function History() {
  const { data: records, isLoading, isError, refetch } = useListPermitQuestions({
    query: { queryKey: getListPermitQuestionsQueryKey(), refetchOnMount: "always" },
  });

  useEffect(() => {
    document.title = "History | Permit Correction Helper";
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />
      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 pb-20">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6 mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">Saved requests</p>
            <h1 className="text-3xl md:text-4xl font-serif font-bold">History</h1>
            <p className="text-muted-foreground mt-2">
              Your permitting questions and AI answers, newest first.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/"><ArrowLeft className="w-4 h-4 mr-2" /> Ask a question</Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4" aria-label="Loading history">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <p className="text-destructive">History could not be loaded. Please try again.</p>
              <Button variant="outline" onClick={() => refetch()}>Retry</Button>
            </CardContent>
          </Card>
        ) : records?.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center space-y-4">
              <MessageCircleQuestion className="w-10 h-10 text-primary mx-auto" />
              <h2 className="text-xl font-serif font-semibold">No saved questions yet</h2>
              <p className="text-muted-foreground">Ask your first permitting question to see it here.</p>
              <Button asChild><Link href="/">Ask a question</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">{records?.length} saved {records?.length === 1 ? "request" : "requests"}</p>
            {records?.map((record) => (
              <Card key={record.id} className="shadow-sm border-border/70">
                <CardContent className="p-5 md:p-7 space-y-5">
                  <time dateTime={record.createdAt} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock3 className="w-4 h-4" />
                    {format(new Date(record.createdAt), "MMM d, yyyy 'at' h:mm a")}
                  </time>
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Your question</h2>
                    <p className="font-medium leading-relaxed whitespace-pre-wrap break-words">{record.question}</p>
                  </div>
                  <div className="border-t border-border/70 pt-5">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">AI response</h3>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{record.response}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}