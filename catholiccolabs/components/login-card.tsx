import Link from "next/link";
import { Heart } from "lucide-react";
import { login } from "@/app/actions";
import { Alert } from "@/components/alert";
import { EmailInput } from "@/components/email-input";
import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { OAuthButtons } from "@/components/oauth-buttons";

type LoginCardProps = {
  align?: "left" | "center";
  subtitle?: string;
  flair?: "heart" | "wave";
  oauthOrientation?: "stack" | "row";
  error?: string;
  message?: string;
  className?: string;
};

/**
 * The white login card shared by the desktop split-screen and the mobile
 * landing. Layout details (alignment, subtitle, OAuth orientation) are tuned
 * per breakpoint by the caller.
 */
export function LoginCard({
  align = "left",
  subtitle = "Log in to continue collaborating and inspiring together.",
  flair = "heart",
  oauthOrientation = "stack",
  error,
  message,
  className = "",
}: LoginCardProps) {
  const centered = align === "center";

  return (
    <div
      className={`rounded-2xl bg-white p-6 shadow-xl shadow-black/5 sm:p-8 ${className}`}
    >
      <header className={`mb-6 ${centered ? "text-center" : ""}`}>
        <h2
          className={`flex items-center gap-2 font-serif text-3xl font-semibold text-ink ${
            centered ? "justify-center" : ""
          }`}
        >
          Welcome back!
          {flair === "heart" ? (
            <Heart className="h-5 w-5 text-gold" />
          ) : (
            <span aria-hidden="true" className="text-2xl">
              👋
            </span>
          )}
        </h2>
        <p className="mt-1.5 text-sm text-ink-soft">{subtitle}</p>
      </header>

      {error && <Alert variant="error">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <form action={login} className="space-y-3.5">
        <EmailInput />
        <PasswordInput />
        <SubmitButton className="mt-1">Log In</SubmitButton>
      </form>

      <div className="my-5 flex items-center gap-4">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          or
        </span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <OAuthButtons orientation={oauthOrientation} />

      <div className="mt-6 text-center">
        <Link
          href="/forgot-password"
          className="text-sm font-semibold text-navy underline-offset-4 transition hover:underline"
        >
          Forgot your password?
        </Link>
      </div>
    </div>
  );
}
