import Image from "next/image";
import { redirect } from "next/navigation";
import { Cross, Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LoginCard } from "@/components/login-card";
import { FeatureSection } from "@/components/feature-section";

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
    <main className="min-h-screen w-full bg-[#efe7da]">
      {/* ---------- Desktop: split-screen ---------- */}
      <div className="hidden min-h-screen lg:grid lg:grid-cols-[1.12fr_1fr]">
        <div className="relative">
          <Image
            src="/images/hero.png"
            alt="People creating, sharing and praying together in faith"
            fill
            priority
            sizes="55vw"
            className="object-cover"
          />
        </div>
        <div className="flex min-h-screen items-center justify-center px-10 py-10">
          <div className="w-full max-w-md">
            <LoginCard
              align="left"
              flair="heart"
              subtitle="Log in to continue collaborating and inspiring together."
              oauthOrientation="stack"
              error={error}
              message={message}
            />
          </div>
        </div>
      </div>

      {/* ---------- Mobile / tablet: stacked landing ---------- */}
      <div className="lg:hidden">
        <div className="mx-auto max-w-md px-5 pb-12 pt-10">
          {/* Brand */}
          <div className="flex flex-col items-center text-center">
            <Cross className="h-7 w-7 text-gold" strokeWidth={2.5} />
            <h1 className="mt-2 font-serif text-4xl font-semibold text-ink">
              Catholic Colabs
            </h1>
            <p className="mt-1.5 text-sm text-ink-soft">
              Collaborate. Create. Grow in Faith.
            </p>
          </div>

          {/* Hero illustration */}
          <div className="relative mt-6 overflow-hidden rounded-3xl">
            <Image
              src="/images/hero-mobile.png"
              alt="Three friends collaborating around a laptop"
              width={863}
              height={318}
              priority
              sizes="100vw"
              className="h-auto w-full"
            />
          </div>

          {/* Login card overlapping the illustration */}
          <div className="relative -mt-8 px-1">
            <LoginCard
              align="center"
              flair="wave"
              subtitle="Log in to continue"
              oauthOrientation="row"
              error={error}
              message={message}
            />
          </div>

          {/* Feature highlights */}
          <FeatureSection />

          <div className="mt-8 flex justify-center">
            <Heart className="h-5 w-5 fill-gold text-gold" />
          </div>
        </div>
      </div>
    </main>
  );
}
