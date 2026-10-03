import { useEffect, useState } from "react";
import { useCreateStaffAccount } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageShell } from "@/components/submission-ui";
import { errorMessage } from "@/lib/documents";

export default function StaffAccountsPage() {
  const create = useCreateStaffAccount();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { document.title = "Staff accounts | Permit Correction Helper"; }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username.trim())) { setResult({ ok: false, text: "Username must be 3-30 letters, numbers, or underscores." }); return; }
    if (password.length < 8 || password.length > 128) { setResult({ ok: false, text: "Password must be 8-128 characters." }); return; }
    try {
      const u = await create.mutateAsync({ data: { username: username.trim(), password } });
      setResult({ ok: true, text: `Staff account "${u.username}" created.` });
      setUsername(""); setPassword("");
    } catch (err) {
      setResult({ ok: false, text: (err as { status?: number })?.status === 409 ? "That username is already taken." : errorMessage(err) });
    }
  };

  return (
    <PageShell>
      <div className="max-w-md space-y-6">
        <div className="space-y-2 border-b border-border pb-6">
          <h1 className="text-3xl font-serif font-bold">Staff accounts</h1>
          <p className="text-sm text-muted-foreground">Create another City staff login. Staff cannot register publicly.</p>
        </div>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1"><Label htmlFor="s-user">Username</Label><Input id="s-user" data-testid="input-staff-username" autoComplete="off" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="s-pass">Password</Label><Input id="s-pass" type="password" data-testid="input-staff-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {result && <p role="alert" data-testid="status-staff-result" className={`rounded-md border px-3 py-2.5 text-sm ${result.ok ? "border-accent/30 bg-accent/5 text-accent" : "border-destructive/25 bg-destructive/5 text-destructive"}`}>{result.text}</p>}
          <Button type="submit" disabled={create.isPending} data-testid="button-create-staff">{create.isPending ? "Creating..." : "Create staff account"}</Button>
        </form>
      </div>
    </PageShell>
  );
}
