import { redirect } from "next/navigation";
import { Cross, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-braces: middleware already guards this route.
  if (!user) {
    redirect("/");
  }

  const name =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email;

  return (
    <main className="min-h-screen bg-[#efe7da]">
      <header className="flex items-center justify-between border-b border-black/5 bg-white/70 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <Cross className="h-5 w-5 text-gold" strokeWidth={2.5} />
          <span className="font-serif text-xl font-semibold text-ink">
            Catholiccolabs.com
          </span>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-ink transition hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-serif text-4xl font-semibold text-ink">
          Welcome, {name} 🕊️
        </h1>
        <p className="mt-3 max-w-prose text-ink-soft">
          You&apos;re signed in. This is your space to create, share and inspire
          — together in faith. Build the rest of the experience from here.
        </p>
      </section>
    </main>
  );
}
