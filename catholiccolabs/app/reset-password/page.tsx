import { redirect } from "next/navigation";
import { updatePassword } from "../actions";
import { createClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/auth-shell";
import { Alert } from "@/components/alert";
import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  // The user must arrive here with a valid recovery session (set by the
  // /auth/callback handler after clicking the email link).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/forgot-password?error=${encodeURIComponent(
        "Your reset link is invalid or has expired. Please request a new one."
      )}`
    );
  }

  const { error, message } = await searchParams;

  return (
    <AuthShell>
      <div className="rounded-2xl bg-white p-8 shadow-xl shadow-black/5 sm:p-10">
        <header className="mb-6">
          <h2 className="font-serif text-3xl font-semibold text-ink">
            Set a new password
          </h2>
          <p className="mt-1.5 text-sm text-ink-soft">
            Choose a strong password you don&apos;t use anywhere else.
          </p>
        </header>

        {error && <Alert variant="error">{error}</Alert>}
        {message && <Alert variant="success">{message}</Alert>}

        <form action={updatePassword} className="space-y-3.5">
          <PasswordInput
            placeholder="New password"
            autoComplete="new-password"
          />
          <PasswordInput
            name="confirm"
            placeholder="Confirm new password"
            autoComplete="new-password"
          />
          <SubmitButton>Update password</SubmitButton>
        </form>
      </div>
    </AuthShell>
  );
}
