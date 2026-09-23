import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { Card, ProgressBar } from "../../components/ui";
import { LevelBadge } from "../../components/LevelBadge";
import { formatMoney } from "../../lib/format";
import type { LoanLevel } from "../../lib/database.types";

export function Progress() {
  const { profile } = useAuth();
  const [levels, setLevels] = useState<LoanLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("loan_levels")
      .select("*")
      .eq("is_active", true)
      .order("level_number")
      .then(({ data, error: queryError }) => {
        if (queryError) {
          setError(queryError.message);
        } else {
          setLevels((data as LoanLevel[]) ?? []);
        }
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="py-10 text-center text-sm text-[var(--muted)]">Cargando...</div>;
  }

  if (error) {
    return <p className="py-10 text-center text-sm text-[var(--brick)]">{error}</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">Tu progreso</h1>
      {levels.map((level) => {
        const isCurrent = level.id === profile?.current_level_id;
        const isPast = profile && levels.findIndex((l) => l.id === profile.current_level_id) > levels.findIndex((l) => l.id === level.id);
        return (
          <Card key={level.id} className={isCurrent ? "border-[var(--brand)]" : isPast ? "opacity-60" : ""}>
            <div className="flex items-center justify-between">
              <LevelBadge level={level} />
              <span className="font-display font-semibold text-[var(--ink)] tabular">{formatMoney(level.principal_amount)}</span>
            </div>
            {isCurrent && (
              <div className="mt-3">
                <ProgressBar value={profile?.loans_completed_current_level ?? 0} max={level.loans_required_to_unlock_next} />
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {profile?.loans_completed_current_level ?? 0} / {level.loans_required_to_unlock_next} préstamos completados para subir de nivel
                </p>
              </div>
            )}
            {isPast && <p className="mt-1 text-xs text-[var(--muted)]">Completado</p>}
            {!isCurrent && !isPast && <p className="mt-1 text-xs text-[var(--muted)]">Bloqueado</p>}
          </Card>
        );
      })}
    </div>
  );
}
