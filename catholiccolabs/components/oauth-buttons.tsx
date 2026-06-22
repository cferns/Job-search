import { loginWithProvider } from "@/app/actions";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#000"
        d="M16.37 12.78c.03 3.27 2.87 4.36 2.9 4.37-.02.08-.45 1.55-1.5 3.07-.9 1.31-1.84 2.62-3.32 2.65-1.45.03-1.92-.86-3.58-.86-1.66 0-2.18.83-3.55.89-1.43.05-2.51-1.42-3.42-2.73-1.86-2.68-3.28-7.58-1.37-10.88a5.3 5.3 0 0 1 4.48-2.72c1.4-.03 2.72.94 3.58.94.85 0 2.46-1.16 4.15-.99.7.03 2.69.28 3.96 2.14-.1.06-2.37 1.38-2.35 4.13M13.64 3.87c.76-.92 1.27-2.2 1.13-3.47-1.09.04-2.42.73-3.2 1.65-.7.81-1.31 2.11-1.15 3.36 1.22.09 2.46-.62 3.22-1.54"
      />
    </svg>
  );
}

function ProviderButton({
  provider,
  label,
  icon,
}: {
  provider: "google" | "apple";
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <form action={loginWithProvider.bind(null, provider)}>
      <button
        type="submit"
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-ink transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
      >
        {icon}
        {label}
      </button>
    </form>
  );
}

/** Social sign-in buttons (Google + Apple) wired to Supabase OAuth. */
export function OAuthButtons() {
  return (
    <div className="space-y-3">
      <ProviderButton
        provider="google"
        label="Continue with Google"
        icon={<GoogleIcon />}
      />
      <ProviderButton
        provider="apple"
        label="Continue with Apple"
        icon={<AppleIcon />}
      />
    </div>
  );
}
