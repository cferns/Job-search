import { CalendarDays, FolderKanban, MessagesSquare, ChevronRight } from "lucide-react";

const FEATURES = [
  {
    icon: CalendarDays,
    title: "Events",
    description: "Create and discover events in your community.",
    iconWrap: "bg-amber-100 text-amber-700",
  },
  {
    icon: FolderKanban,
    title: "Projects",
    description: "Work together on meaningful projects that make an impact.",
    iconWrap: "bg-emerald-100 text-emerald-700",
  },
  {
    icon: MessagesSquare,
    title: "Chat",
    description: "Connect and communicate with your team in real time.",
    iconWrap: "bg-sky-100 text-sky-700",
  },
];

/** "Everything you need to do great things—together" feature list. */
export function FeatureSection() {
  return (
    <section className="mt-10">
      <h3 className="px-1 text-center font-serif text-xl font-semibold text-ink">
        Everything you need to do great things—together.
      </h3>

      <ul className="mt-5 space-y-3">
        {FEATURES.map(({ icon: Icon, title, description, iconWrap }) => (
          <li key={title}>
            <button
              type="button"
              className="flex w-full items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-sm shadow-black/5 transition hover:shadow-md"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconWrap}`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{title}</span>
                <span className="block text-sm text-ink-soft">
                  {description}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
