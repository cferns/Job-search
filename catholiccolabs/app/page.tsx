import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { login } from "./actions";
import { AuthShell } from "@/components/auth-shell";
import { Alert } from "@/components/alert";
import { EmailInput } from "@/components/email-input";
import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { OAuthButtons } from "@/components/oauth-buttons";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  const { error, message } = await searchParams;

  return (
    <AuthShell>
      <div className="rounded-2xl bg-white p-8 shadow-xl shadow-black/5 sm:p-10">
        <header className="mb-6">
          <h2 className="flex items-center gap-2 font-serif text-3xl font-semibold text-ink">
            Welcome back!
            <Heart className="h-5 w-5 text-gold" />
          </h2>
          <p className="mt-1.5 text-sm text-ink-soft">
            Log in to continue collaborating and inspiring together.
          </p>
        </header>

        {error && <Alert variant="error">{error}</Alert>}
        {message && <Alert variant="success">{message}</Alert>}

        <form action={login} className="space-y-3.5">
          <EmailInput autoFocus />
          <PasswordInput />
          <SubmitButton className="mt-1">Log In</SubmitButton>
        </form>

        <div className="my-6 flex items-center gap-4">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            or
          </span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <OAuthButtons />

        <div className="mt-6 text-center">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-ink-soft underline-offset-4 transition hover:text-navy hover:underline"
          >
            Forgot your password?
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
