"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Provider } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/supabase/env";

/**
 * Resolve the origin to use for redirect URLs. Prefers the configured site URL,
 * falling back to the request's own origin so local/preview deploys work too.
 */
async function resolveOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const origin = h.get("origin");
  return origin ? origin.replace(/\/$/, "") : getSiteUrl();
}

function encodeMessage(msg: string) {
  return encodeURIComponent(msg);
}

/** Email + password sign-in. */
export async function login(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    redirect(`/?error=${encodeMessage("Please enter your email and password.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/?error=${encodeMessage(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/** Email + password sign-up. */
export async function signup(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    redirect(`/?error=${encodeMessage("Please enter your email and password.")}`);
  }

  const origin = await resolveOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    redirect(`/?error=${encodeMessage(error.message)}`);
  }

  redirect(
    `/?message=${encodeMessage(
      "Check your email to confirm your account, then log in."
    )}`
  );
}

/** OAuth sign-in (Google / Apple / etc.). */
export async function loginWithProvider(provider: Provider) {
  const origin = await resolveOrigin();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/?error=${encodeMessage(error.message)}`);
  }

  if (data.url) {
    redirect(data.url);
  }

  redirect(`/?error=${encodeMessage("Could not start sign-in. Try again.")}`);
}

/** Send a password-reset email. */
export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") || "").trim();

  if (!email) {
    redirect(
      `/forgot-password?error=${encodeMessage("Please enter your email.")}`
    );
  }

  const origin = await resolveOrigin();
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    redirect(`/forgot-password?error=${encodeMessage(error.message)}`);
  }

  redirect(
    `/forgot-password?message=${encodeMessage(
      "If that email exists, a reset link is on its way."
    )}`
  );
}

/** Set a new password for the currently-authenticated (recovery) session. */
export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");

  if (password.length < 8) {
    redirect(
      `/reset-password?error=${encodeMessage(
        "Password must be at least 8 characters."
      )}`
    );
  }
  if (password !== confirm) {
    redirect(
      `/reset-password?error=${encodeMessage("Passwords do not match.")}`
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/reset-password?error=${encodeMessage(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect(
    `/?message=${encodeMessage("Password updated. Please log in.")}`
  );
}

/** Sign the current user out. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
