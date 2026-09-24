import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Eye, EyeOff, FileCheck2, LockKeyhole, ShieldAlert } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useLocation } from "wouter";
import { z } from "zod";
import { getGetMeQueryKey, useSignUp } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const signUpSchema = z.object({
  username: z.string().trim().min(3, "Use at least 3 characters.").max(30, "Use 30 characters or fewer.").regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers, or underscores only."),
  password: z.string().min(8, "Use at least 8 characters.").max(128, "Use 128 characters or fewer."),
  confirmPassword: z.string().min(1, "Please confirm your password."),
}).refine((values) => values.password === values.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

type SignUpValues = z.infer<typeof signUpSchema>;

export default function SignUpPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const signUp = useSignUp();
  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { username: "", password: "", confirmPassword: "" },
  });

  useEffect(() => {
    document.title = "Create account | Permit Correction Helper";
  }, []);

  async function onSubmit(values: SignUpValues) {
    setServerError("");
    try {
      const user = await signUp.mutateAsync({ data: { username: values.username, password: values.password } });
      queryClient.clear();
      queryClient.setQueryData(getGetMeQueryKey(), user);
      setLocation("/");
    } catch (error) {
      if ((error as { status?: number })?.status === 409) {
        form.setError("username", { type: "server", message: "That username is already taken. Try another." });
      } else {
        setServerError("We couldn't create your account right now. Please try again.");
      }
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="mx-auto flex h-18 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" data-testid="link-home" className="inline-flex items-center gap-2.5 text-primary transition-opacity hover:opacity-75">
          <ShieldAlert className="h-5 w-5 shrink-0" strokeWidth={1.8} />
          <span className="font-serif text-lg font-semibold tracking-tight">Permit Correction Helper</span>
        </Link>
        <Link href="/login" data-testid="link-login-header" className="hidden text-sm font-semibold text-primary underline-offset-4 hover:underline sm:inline">
          Log in
        </Link>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-12 px-5 pb-16 pt-10 sm:px-8 md:grid-cols-[minmax(0,1fr)_minmax(0,460px)] md:items-center md:gap-16 md:pt-20">
        <div className="max-w-lg">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
            <FileCheck2 className="h-3.5 w-3.5" />
            A clearer path forward
          </div>
          <h1 className="max-w-[12ch] font-serif text-[clamp(2.75rem,5vw,4.5rem)] font-medium leading-[1.08] tracking-[-0.035em]">
            Keep your corrections in one place.
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
            Create an account to save your reports, revisit city comments, and pick up where you left off.
          </p>
          <div className="mt-10 hidden border-t border-border pt-6 md:block">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">What you can count on</p>
            <p className="mt-3 max-w-sm font-serif text-xl leading-snug text-primary">
              A working list of what needs attention, not another document to decipher.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-card-border bg-card p-6 shadow-[0_16px_50px_-35px_hsl(var(--primary)/0.24)] sm:p-9">
          <div className="mb-8">
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-accent">New account / 01</p>
            <h2 className="font-serif text-3xl font-semibold tracking-tight">Create your account</h2>
            <p className="mt-2 text-sm text-muted-foreground">A few details, then you can get started.</p>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
              <FormField control={form.control} name="username" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">Username</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-username" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Choose a username" onChange={(event) => { field.onChange(event); setServerError(""); form.clearErrors("username"); }} className="h-11 border-input bg-background/60 px-3.5 focus-visible:ring-primary" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input {...field} data-testid="input-password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="At least 8 characters" className="h-11 border-input bg-background/60 px-3.5 pr-11 focus-visible:ring-primary" onChange={(event) => { field.onChange(event); setServerError(""); }} />
                      <button type="button" data-testid="button-toggle-password" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute inset-y-0 right-1 flex w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">Confirm password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input {...field} data-testid="input-confirm-password" type={showConfirmation ? "text" : "password"} autoComplete="new-password" placeholder="Enter your password again" className="h-11 border-input bg-background/60 px-3.5 pr-11 focus-visible:ring-primary" onChange={(event) => { field.onChange(event); form.clearErrors("confirmPassword"); setServerError(""); }} />
                      <button type="button" data-testid="button-toggle-confirm-password" onClick={() => setShowConfirmation((value) => !value)} aria-label={showConfirmation ? "Hide confirmation" : "Show confirmation"} className="absolute inset-y-0 right-1 flex w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary">
                        {showConfirmation ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {serverError && <p role="alert" data-testid="status-signup-error" className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">{serverError}</p>}
              <Button type="submit" data-testid="button-create-account" disabled={signUp.isPending} className="h-11 w-full gap-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
                {signUp.isPending ? "Creating account…" : "Create Account"}
                {!signUp.isPending && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
          </Form>
          <p className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
            Already have an account? <Link href="/login" data-testid="link-login" className="font-semibold text-primary underline-offset-4 hover:underline">Log in</Link>
          </p>
        </div>
      </main>
      <footer className="mx-auto flex max-w-6xl items-center gap-2 px-5 pb-8 text-xs text-muted-foreground sm:px-8">
        <LockKeyhole className="h-3.5 w-3.5" /> Your reports stay with your account.
      </footer>
    </div>
  );
}