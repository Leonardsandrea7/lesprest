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

  function update(id: string, key: keyof LoanLevel, value: number | boolean | number[]) {
    setLevels((ls) => ls.map((l) => (l.id === id ? { ...l, [key]: value } : l)));
  }

  function toggleChoice(level: LoanLevel, n: number) {
    const current = level.installment_choices ?? [1];
    const next = current.includes(n) ? current.filter((c) => c !== n) : [...current, n].sort();
    update(level.id, "installment_choices", next.length ? next : [1]);
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
        allow_installments: level.allow_installments,
        installment_choices: level.installment_choices,
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

              <div className="mt-4 border-t border-[var(--line)] pt-4">
                <label className="flex items-center gap-2 text-sm font-medium text-[var(--ink)]">
                  <input
                    type="checkbox"
                    checked={level.allow_installments}
                    onChange={(e) => update(level.id, "allow_installments", e.target.checked)}
                  />
                  Permitir que el usuario elija pagar en cuotas
                </label>
                {level.allow_installments && (
                  <div className="mt-2 flex gap-2">
                    {[1, 2, 3].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => toggleChoice(level, n)}
                        className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                          (level.installment_choices ?? []).includes(n)
                            ? "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]"
                            : "border-[var(--line)] text-[var(--muted)]"
                        }`}
                      >
                        {n === 1 ? "Todo junto" : `${n} cuotas`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Button className="mt-4" disabled={saving === level.id} onClick={() => save(level)}>
                {saving === level.id ? "Guardando..." : "Guardar nivel"}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
