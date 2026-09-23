import { useEffect, useRef, useState } from "react";
import { playLevelClimb } from "../lib/sound";

/**
 * Fila de niveles con una pelotita que "salta" desde el nivel 1 hasta el
 * nivel actual del usuario, iluminando cada nivel a su paso, con un
 * sonido de piano que sube de tono en cada salto. Se reproduce sola al
 * montarse (por ejemplo, cada vez que se abre el Dashboard).
 */
export function LevelJourney({ currentLevelNumber, maxLevel = 6 }: { currentLevelNumber: number; maxLevel?: number }) {
  const [litUpTo, setLitUpTo] = useState(0);
  const [bounceIndex, setBounceIndex] = useState<number | null>(null);
  const played = useRef(false);

  useEffect(() => {
    if (played.current) return;
    played.current = true;

    const steps = Math.min(currentLevelNumber, maxLevel);
    setLitUpTo(0);
    setBounceIndex(null);

    playLevelClimb(steps, (i) => {
      setBounceIndex(i + 1);
      setLitUpTo(i + 1);
      // Quita el "rebote" un instante después para que se vea como un
      // salto y no como que se queda pegada ahí.
      setTimeout(() => setBounceIndex((current) => (current === i + 1 ? null : current)), 220);
    });
  }, [currentLevelNumber, maxLevel]);

  const levels = Array.from({ length: maxLevel }, (_, i) => i + 1);

  return (
    <div className="overflow-x-hidden py-2">
      <div className="flex items-end justify-between gap-1">
        {levels.map((n) => {
          const isLit = n <= litUpTo;
          const isBouncing = bounceIndex === n;
          return (
            <div key={n} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                  isBouncing ? "-translate-y-2 scale-110" : ""
                } ${
                  isLit
                    ? "bg-[var(--gold)] text-white shadow-[0_0_14px_var(--gold)]"
                    : "bg-[var(--paper-raised)] text-[var(--muted)] border border-[var(--line)]"
                }`}
              >
                {n}
              </div>
              <span className={`h-1 w-1 rounded-full transition-colors ${isLit ? "bg-[var(--gold)]" : "bg-[var(--line)]"}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
