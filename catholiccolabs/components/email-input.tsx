import { Mail } from "lucide-react";

/** Email field with a leading mail icon. */
export function EmailInput({
  defaultValue = "",
  autoFocus = false,
}: {
  defaultValue?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="relative">
      <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="email"
        name="email"
        placeholder="Email"
        autoComplete="email"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        required
        className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-3 pl-10 pr-4 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-navy focus:bg-white focus:ring-2 focus:ring-navy/15"
      />
    </div>
  );
}
