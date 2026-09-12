import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Card, Button, Field, Input, Alert } from "../../components/ui";
import type { LoanLevel } from "../../lib/database.types";

export function AdminLevels() {
  const [levels, setLevels] = useState<LoanLevel[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from("loan_levels").select("*").order("level_number");
    setLevels((data as LoanLevel[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  function update(id: string, key: keyof LoanLevel, value: number) {
    setLevels((ls) => ls.map((l) => (l.id === id ? { ...l, [key]: value } : l)));
  }

  async function save(level: LoanLevel) {
    setSaving(level.id);
    setMessage(null);
    const { error } = await supabase
      .from("loan_levels")
      .update({
        principal_amount: level.principal_amount,
        return_rate_percent: level.return_rate_percent,
        term_days: level.term_days,
        loans_required_to_unlock_next: level.loans_required_to_unlock_next,
      })
      .eq("id", level.id);
    setSaving(null);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(`Nivel ${level.level_number} actualizado.`);
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">Niveles de préstamo</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Estos valores controlan toda la plataforma. Ningún monto o porcentaje está fijo en el código.
      </p>

      {message && <div className="mt-4"><Alert kind="info">{message}</Alert></div>}

      <div className="mt-5 space-y-4">
        {levels.map((level) => {
          const returnAmount = Math.round(level.principal_amount * (level.return_rate_percent / 100) * 100) / 100;
          return (
            <Card key={level.id}>
              <p className="font-display font-semibold text-[var(--ink)]">Nivel {level.level_number}</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Monto del préstamo ($)">
                  <Input type="number" step="0.01" value={level.principal_amount} onChange={(e) => update(level.id, "principal_amount", Number(e.target.value))} />
                </Field>
                <Field label="Retorno (%)">
                  <Input type="number" step="0.1" value={level.return_rate_percent} onChange={(e) => update(level.id, "return_rate_percent", Number(e.target.value))} />
                </Field>
                <Field label="Plazo (días)">
                  <Input type="number" value={level.term_days} onChange={(e) => update(level.id, "term_days", Number(e.target.value))} />
                </Field>
                <Field label="Préstamos requeridos para subir">
                  <Input type="number" value={level.loans_required_to_unlock_next} onChange={(e) => update(level.id, "loans_required_to_unlock_next", Number(e.target.value))} />
                </Field>
              </div>
              <p className="mt-3 text-sm text-[var(--muted)] tabular">
                Ganancia: ${returnAmount.toFixed(2)} · Total a devolver: ${(level.principal_amount + returnAmount).toFixed(2)}
              </p>
              <Button className="mt-3" disabled={saving === level.id} onClick={() => save(level)}>
                {saving === level.id ? "Guardando..." : "Guardar nivel"}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
