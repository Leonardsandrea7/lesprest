import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Card, Badge, Button, EmptyState, Field, Input } from "../../components/ui";
import { formatMoney, formatBs, formatDate, loanStatusLabels, loanStatusColors } from "../../lib/format";
import { useExchangeRate } from "../../lib/useExchangeRate";
import type { Loan, UserPaymentMethod } from "../../lib/database.types";

interface LoanRow extends Loan {
  user_payment_methods?: UserPaymentMethod[];
}

export function AdminLoans() {
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [disbForm, setDisbForm] = useState<Record<string, { amount: string; bank: string; reference: string; date: string; time: string }>>({});
  const rate = useExchangeRate();

  async function load() {
    const { data } = await supabase.from("loans").select("*").order("requested_at", { ascending: false });
    setLoans((data as LoanRow[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function review(loan: Loan, decision: "aprobar" | "rechazar") {
    const reason = decision === "rechazar" ? window.prompt("Motivo del rechazo:") ?? undefined : undefined;
    const { error } = await supabase.rpc("admin_review_loan", { p_loan_id: loan.id, p_decision: decision, p_reason: reason });
    if (error) return alert(error.message);
    load();
  }

  async function confirmDisbursement(loan: Loan) {
    const f = disbForm[loan.id];
    if (!f?.amount || !f?.bank || !f?.reference || !f?.date || !f?.time) {
      alert("Completa todos los campos del desembolso.");
      return;
    }
    const { error } = await supabase.rpc("admin_confirm_disbursement", {
      p_loan_id: loan.id,
      p_amount_sent: Number(f.amount),
      p_bank: f.bank,
      p_reference: f.reference,
      p_date: f.date,
      p_time: f.time,
    });
    if (error) return alert(error.message);
    load();
  }

  function updateDisb(loanId: string, key: string, value: string) {
    setDisbForm((s) => ({ ...s, [loanId]: { ...s[loanId], [key]: value } as any }));
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">Préstamos</h1>
      {loans.length === 0 && <div className="mt-4"><EmptyState title="Sin préstamos" body="Las solicitudes aparecerán aquí." /></div>}

      <div className="mt-4 space-y-3">
        {loans.map((loan) => {
          const isOpen = expanded === loan.id;
          return (
            <Card key={loan.id}>
              <button className="flex w-full items-center justify-between text-left" onClick={() => setExpanded(isOpen ? null : loan.id)}>
                <div>
                  <p className="font-semibold text-[var(--ink)]">{loan.public_id} · Nivel {loan.level_number}</p>
                  <p className="text-xs text-[var(--muted)] tabular">{formatMoney(loan.principal_amount)} · {formatDate(loan.requested_at)}</p>
                </div>
                <Badge className={loanStatusColors[loan.status]}>{loanStatusLabels[loan.status]}</Badge>
              </button>

              {isOpen && (
                <div className="mt-4 space-y-4 border-t border-[var(--line)] pt-4 text-sm">
                  <dl className="grid grid-cols-2 gap-3">
                    <Info label="Total a devolver" value={formatMoney(loan.total_amount)} sub={rate ? formatBs(loan.total_amount, rate) : undefined} />
                    <Info label="Plazo" value={`${loan.term_days} días`} />
                    <Info label="Pagado" value={formatMoney(loan.amount_paid)} sub={rate ? formatBs(loan.amount_paid, rate) : undefined} />
                    <Info label="Vencimiento" value={formatDate(loan.due_at)} />
                  </dl>

                  {["solicitado", "en_revision"].includes(loan.status) && (
                    <div className="flex gap-2">
                      <Button onClick={() => review(loan, "aprobar")}>✓ Aprobar</Button>
                      <Button variant="danger" onClick={() => review(loan, "rechazar")}>✕ Rechazar</Button>
                    </div>
                  )}

                  {loan.status === "aprobado" && (
                    <div className="space-y-3 rounded-xl bg-black/[0.03] p-4">
                      <p className="font-medium text-[var(--ink)]">Registrar desembolso manual</p>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Monto enviado">
                          <Input type="number" step="0.01" onChange={(e) => updateDisb(loan.id, "amount", e.target.value)} />
                        </Field>
                        <Field label="Banco utilizado">
                          <Input onChange={(e) => updateDisb(loan.id, "bank", e.target.value)} />
                        </Field>
                        <Field label="N° de referencia">
                          <Input onChange={(e) => updateDisb(loan.id, "reference", e.target.value)} />
                        </Field>
                        <Field label="Fecha">
                          <Input type="date" onChange={(e) => updateDisb(loan.id, "date", e.target.value)} />
                        </Field>
                        <Field label="Hora">
                          <Input type="time" onChange={(e) => updateDisb(loan.id, "time", e.target.value)} />
                        </Field>
                      </div>
                      <Button onClick={() => confirmDisbursement(loan)}>Confirmar desembolso</Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Info({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd className="tabular text-[var(--ink)]">{value}</dd>
      {sub && <dd className="text-xs text-[var(--muted)] tabular">{sub}</dd>}
    </div>
  );
}
