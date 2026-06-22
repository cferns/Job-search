import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requestPasswordReset } from "../actions";
import { AuthShell } from "@/components/auth-shell";
import { Alert } from "@/components/alert";
import { EmailInput } from "@/components/email-input";
import { SubmitButton } from "@/components/submit-button";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <AuthShell>
      <div className="rounded-2xl bg-white p-8 shadow-xl shadow-black/5 sm:p-10">
        <header className="mb-6">
          <h2 className="font-serif text-3xl font-semibold text-ink">
            Forgot your password?
          </h2>
          <p className="mt-1.5 text-sm text-ink-soft">
            Enter your email and we&apos;ll send you a link to reset it.
          </p>
        </header>

        {error && <Alert variant="error">{error}</Alert>}
        {message && <Alert variant="success">{message}</Alert>}

        <form action={requestPasswordReset} className="space-y-3.5">
          <EmailInput autoFocus />
          <SubmitButton>Send reset link</SubmitButton>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft underline-offset-4 transition hover:text-navy hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to log in
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
