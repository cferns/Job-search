import Image from "next/image";
import { Cross } from "lucide-react";

/**
 * Two-column auth layout: the faith illustration on the left, the form card on
 * the right. On small screens the illustration collapses to a compact brand
 * header so the form stays front-and-centre.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen w-full bg-[#efe7da] lg:grid lg:grid-cols-[1.12fr_1fr]">
      {/* Illustration */}
      <div className="relative hidden lg:block">
        <Image
          src="/images/hero.png"
          alt="People creating, sharing and praying together in faith"
          fill
          priority
          sizes="(min-width: 1024px) 55vw, 100vw"
          className="object-cover"
        />
      </div>

      {/* Form side */}
      <div className="flex min-h-screen flex-col items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          {/* Mobile-only brand header */}
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <Cross className="h-7 w-7 text-gold" strokeWidth={2.5} />
            <h1 className="mt-2 font-serif text-3xl font-semibold text-ink">
              Catholic Colabs
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              Collaborate. Create. Grow in Faith.
            </p>
          </div>

          {children}
        </div>
      </div>
    </main>
  );
}
