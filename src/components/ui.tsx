import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none";
  const styles: Record<string, string> = {
    primary: "bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]",
    secondary: "bg-[var(--paper-raised)] text-[var(--ink)] border border-[var(--line)] hover:border-[var(--brand)]",
    ghost: "text-[var(--brand)] hover:bg-[var(--brand)]/10",
    danger: "bg-[var(--brick)] text-white hover:opacity-90",
  };
  return (
    <button className={`${base} ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 ${className}`}>
      {children}
    </div>
  );
}

export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-[var(--ink)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[var(--muted)]">{hint}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] px-4 py-3 text-[15px] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] px-4 py-3 text-[15px] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] px-4 py-3 text-[15px] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 ${props.className ?? ""}`}
    />
  );
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--line)]/60">
      <div
        className="h-full rounded-full bg-[var(--gold)] transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--line)] p-8 text-center">
      <p className="font-display text-base font-semibold text-[var(--ink)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{body}</p>
    </div>
  );
}

export function Alert({ kind = "error", children }: { kind?: "error" | "info" | "success"; children: ReactNode }) {
  const styles = {
    error: "bg-red-50 text-[var(--brick)] border-red-200",
    info: "bg-sky-50 text-sky-800 border-sky-200",
    success: "bg-sky-50 text-sky-800 border-sky-200",
  };
  return <div className={`rounded-xl border px-4 py-3 text-sm ${styles[kind]}`}>{children}</div>;
}
