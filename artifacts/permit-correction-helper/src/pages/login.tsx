import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Eye, EyeOff, FileCheck2, LockKeyhole, ShieldAlert } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useLocation } from "wouter";
import { z } from "zod";
import { getGetMeQueryKey, useLogIn } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username."),
  password: z.string().min(1, "Enter your password."),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const login = useLogIn();
  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  useEffect(() => {
    document.title = "Log in | Permit Correction Helper";
  }, []);

  async function onSubmit(values: LoginValues) {
    setServerError("");
    try {
      const user = await login.mutateAsync({ data: values });
      queryClient.clear();
      queryClient.setQueryData(getGetMeQueryKey(), user);
      setLocation(user.role === "city_staff_admin" ? "/staff" : "/");
    } catch (error) {
      setServerError((error as { status?: number })?.status === 401
        ? "That username and password don't match. Check your details and try again."
        : "We couldn't log you in right now. Please try again.");
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="mx-auto flex h-18 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" data-testid="link-home" className="inline-flex items-center gap-2.5 text-primary transition-opacity hover:opacity-75">
          <ShieldAlert className="h-5 w-5 shrink-0" strokeWidth={1.8} />
          <span className="font-serif text-lg font-semibold tracking-tight">Permit Correction Helper</span>
        </Link>
        <Link href="/signup" data-testid="link-signup-header" className="hidden text-sm font-semibold text-primary underline-offset-4 hover:underline sm:inline">
          Create account
        </Link>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-12 px-5 pb-16 pt-10 sm:px-8 md:grid-cols-[minmax(0,1fr)_minmax(0,460px)] md:items-center md:gap-16 md:pt-20">
        <div className="max-w-lg">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
            <FileCheck2 className="h-3.5 w-3.5" />
            Your work, ready when you are
          </div>
          <h1 className="max-w-[12ch] font-serif text-[clamp(2.75rem,5vw,4.5rem)] font-medium leading-[1.08] tracking-[-0.035em]">
            Get back to what matters.
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
            Residents and City Staff log in here. Review your saved correction reports and keep moving toward resubmittal.
          </p>
          <div className="mt-10 hidden border-t border-border pt-6 md:block">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">A steady place to return to</p>
            <p className="mt-3 max-w-sm font-serif text-xl leading-snug text-primary">
              Every comment accounted for. Every next step a little clearer.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-card-border bg-card p-6 shadow-[0_16px_50px_-35px_hsl(var(--primary)/0.24)] sm:p-9">
          <div className="mb-8">
            <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Welcome back / 01</p>
            <h2 className="font-serif text-3xl font-semibold tracking-tight">Log in</h2>
            <p className="mt-2 text-sm text-muted-foreground">For residents and City Staff.</p>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
              <FormField control={form.control} name="username" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">Username</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-username" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Your username" onChange={(event) => { field.onChange(event); setServerError(""); }} className="h-11 border-input bg-background/60 px-3.5 focus-visible:ring-primary" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input {...field} data-testid="input-password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Your password" onChange={(event) => { field.onChange(event); setServerError(""); }} className="h-11 border-input bg-background/60 px-3.5 pr-11 focus-visible:ring-primary" />
                      <button type="button" data-testid="button-toggle-password" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute inset-y-0 right-1 flex w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {serverError && <p role="alert" data-testid="status-login-error" className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">{serverError}</p>}
              <Button type="submit" data-testid="button-login" disabled={login.isPending} className="h-11 w-full gap-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
                {login.isPending ? "Logging in…" : "Log In"}
                {!login.isPending && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
          </Form>
          <p className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
            Don't have an account? <Link href="/signup" data-testid="link-signup" className="font-semibold text-primary underline-offset-4 hover:underline">Sign up</Link>
          </p>
        </div>
      </main>
      <footer className="mx-auto flex max-w-6xl items-center gap-2 px-5 pb-8 text-xs text-muted-foreground sm:px-8">
        <LockKeyhole className="h-3.5 w-3.5" /> Your reports stay with your account.
      </footer>
    </div>
  );
}