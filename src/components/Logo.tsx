export function Logo({ size = "md", withText = true }: { size?: "sm" | "md" | "lg"; withText?: boolean }) {
  const box = size === "sm" ? "h-7 w-7 text-xs" : size === "lg" ? "h-11 w-11 text-lg" : "h-9 w-9 text-sm";
  const textSize = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-lg";

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`flex ${box} shrink-0 items-center justify-center rounded-xl bg-[var(--brand)] font-display font-extrabold text-white`}
      >
        LP
      </span>
      {withText && (
        <span className={`font-display ${textSize} font-semibold text-[var(--ink)]`}>LES PREST</span>
      )}
    </span>
  );
}
