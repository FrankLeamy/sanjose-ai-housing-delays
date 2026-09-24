import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ArrowRight, MessageCircleQuestion, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAskPermitQuestion,
  getListPermitQuestionsQueryKey,
  type PermitQuestion,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export default function QuestionPanel() {
  const [question, setQuestion] = useState("");
  const [saved, setSaved] = useState<PermitQuestion | null>(null);
  const ask = useAskPermitQuestion();
  const queryClient = useQueryClient();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = question.trim();
    if (!value || ask.isPending) return;

    ask.mutate(
      { data: { question: value } },
      {
        onSuccess: (record) => {
          setSaved(record);
          setQuestion("");
          queryClient.invalidateQueries({ queryKey: getListPermitQuestionsQueryKey() });
        },
      },
    );
  };

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-xl">
          <MessageCircleQuestion className="w-5 h-5 text-primary" />
          Ask a permitting question
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Get a plain-language answer. Your question and answer will be saved to History.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={submit} className="space-y-3">
          <label htmlFor="permit-question" className="text-sm font-medium">
            Your question
          </label>
          <Textarea
            id="permit-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={5000}
            placeholder="e.g. What should I do if a city reviewer asks for a revised site plan? [243]"
            className="min-h-28 resize-y bg-background"
            disabled={ask.isPending}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              Answers are guidance only, not permit approval.
            </span>
            <Button type="submit" disabled={!question.trim() || ask.isPending} className="gap-2">
              <Sparkles className="w-4 h-4" />
              {ask.isPending ? "Generating answer..." : "Ask question"}
            </Button>
          </div>
        </form>

        {ask.isError && (
          <p role="alert" className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            Could not generate and save an answer right now. Please try again.
          </p>
        )}

        {saved && (
          <section aria-live="polite" className="rounded-lg border border-primary/20 bg-primary/5 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-serif font-semibold">Your answer</h3>
              <time dateTime={saved.createdAt} className="text-xs text-muted-foreground">
                Saved {format(new Date(saved.createdAt), "MMM d, yyyy 'at' h:mm a")}
              </time>
            </div>
            <p className="font-medium whitespace-pre-wrap break-words">{saved.question}</p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{saved.response}</p>
            <Link href="/history" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              View in History <ArrowRight className="w-4 h-4" />
            </Link>
          </section>
        )}
      </CardContent>
    </Card>
  );
}