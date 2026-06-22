import { AlertCircle, CheckCircle2 } from "lucide-react";

type AlertProps = {
  variant: "error" | "success";
  children: React.ReactNode;
};

/** Inline notification banner for form-level errors and confirmations. */
export function Alert({ variant, children }: AlertProps) {
  const isError = variant === "error";
  const Icon = isError ? AlertCircle : CheckCircle2;

  return (
    <div
      role={isError ? "alert" : "status"}
      className={`mb-4 flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm ${
        isError
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
