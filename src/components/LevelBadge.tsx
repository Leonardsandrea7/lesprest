import type { LoanLevel } from "../lib/database.types";

export function LevelBadge({ level, size = "md" }: { level: LoanLevel; size?: "sm" | "md" | "lg" }) {
  const color = level.badge_color || "#0a6cf5";
  const name = level.display_name || `Nivel ${level.level_number}`;
  const padding = size === "sm" ? "px-2.5 py-1 text-xs" : size === "lg" ? "px-4 py-1.5 text-sm" : "px-3 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold text-white ${padding}`}
      style={{ backgroundColor: color }}
    >
      {name}
    </span>
  );
}
