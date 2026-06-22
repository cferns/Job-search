"use client";

import { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";

type PasswordInputProps = {
  name?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
};

/** Password field with a show/hide toggle, matching the email field styling. */
export function PasswordInput({
  name = "password",
  placeholder = "Password",
  autoComplete = "current-password",
  required = true,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type={visible ? "text" : "password"}
        name={name}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-3 pl-10 pr-11 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-navy focus:bg-white focus:ring-2 focus:ring-navy/15"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
