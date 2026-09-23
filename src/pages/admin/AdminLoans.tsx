import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Card, Badge, Button, EmptyState, Field, Input } from "../../components/ui";
import { formatMoney, formatBs, formatDate, loanStatusLabels, loanStatusColors, installmentStatusLabels, installmentStatusColors } from "../../lib/format";
import { useExchangeRate } from "../../lib/useExchangeRate";
import { playSuccessSound } from "../../lib/sound";
import { notifyUserPush } from "../../lib/notifyUserPush";
import type { Loan, LoanInstallment, UserPaymentMethod } from "../../lib/database.types";

interface LoanRow extends Loan {
  user_payment_methods?: UserPaymentMethod[];
}

export function AdminLoans() {
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [installmentsByLoan, setInstallmentsByLoan] = useState<Record<string, LoanInstallment[]>>({});
  const [disbForm, setDisbForm] = useState<Record<string, { amount: string; bank: string; reference: string; date: string; time: string }>>({});
  const rate = useExchangeRate();

  async function load() {
    const { data } = await supabase.from("loans").select("*").order("requested_at", { ascending: false });
    setLoans((data as LoanRow[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleExpand(loan: LoanRow) {
    const next = expanded === loan.id ? null : loan.id;
    setExpanded(next);
    if (next && loan.installments_count > 1 && !installmentsByLoan[loan.id]) {
      const { data } = await supabase
        .from("loan_installments")
        .select("*")
        .eq("loan_id", loan.id)
        .order("installment_number", { ascending: true });
      setInstallmentsByLoan((s) => ({ ...s, [loan.id]: (data as LoanInstallment[]) ?? [] }));
    }
  }

  async function review(loan: Loan, decision: "aprobar" | "rechazar") {
    const reason = decision === "rechazar" ? window.prompt("Motivo del rechazo:") ?? undefined : undefined;
    const { error } = await supabase.rpc("admin_review_loan", { p_loan_id: loan.id, p_decision: decision, p_reason: reason });
    if (error) return alert(error.message);
    if (decision === "aprobar") {
      playSuccessSound();
      notifyUserPush(loan.user_id, "Préstamo aprobado ✅", `Tu préstamo ${loan.public_id} fue aprobado. Pronto recibirás el desembolso.`);
    }
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
    notifyUserPush(loan.user_id, "¡Tu dinero está en camino! 💸", `El préstamo ${loan.public_id} fue desembolsado a tu Pago Móvil.`);
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
              <button className="flex w-full items-center justify-between text-left" onClick={() => toggleExpand(loan)}>
                <div>
                  <p className="font-semibold text-[var(--ink)]">
                    {loan.public_id} · Nivel {loan.level_number}
                    {loan.installments_count > 1 && ` · ${loan.installments_count} cuotas`}
                  </p>
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

                  {loan.installments_count > 1 && installmentsByLoan[loan.id] && (
                    <div className="rounded-xl bg-black/[0.03] p-4">
                      <p className="font-medium text-[var(--ink)]">Calendario de cuotas</p>
                      <div className="mt-2 space-y-2">
                        {installmentsByLoan[loan.id].map((inst) => (
                          <div key={inst.id} className="flex items-center justify-between">
                            <span className="text-[var(--ink)]">Cuota {inst.installment_number} · {formatDate(inst.due_at)}</span>
                            <div className="flex items-center gap-2">
                              <span className="tabular text-[var(--ink)]">{formatMoney(inst.amount)}</span>
                              <Badge className={installmentStatusColors[inst.status]}>{installmentStatusLabels[inst.status]}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {["solicitado", "en_revision"].includes(loan.status) && (
                    <div className="flex gap-2">
                      <Button onClick={() => review(loan, "aprobar")}>✓ Aprobar</Button>
                      <Button variant="danger" onClick={() => review(loan, "rechazar")}>✕ Rechazar</Button>
                    </div>
                  )}

                  {loan.status === "aprobado" && (
                    <div className="space-y-3 rounded-xl bg-black/[0.03] p-4">
                      <p className="font-medium text-[var(--ink)]">Registrar desembolso manual</p>
                      {rate && (
                        <div className="rounded-lg bg-[var(--brand)]/10 px-3 py-2 text-sm">
                          <p className="font-semibold text-[var(--brand)]">
                            Transferir por Pago Móvil: {formatBs(loan.principal_amount, rate)}
                          </p>
                          <p className="text-xs text-[var(--muted)]">
                            Equivale a {formatMoney(loan.principal_amount)} al tipo de cambio actual.
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Monto enviado (Bs.)">
                          <Input
                            type="number"
                            step="0.01"
                            value={disbForm[loan.id]?.amount ?? (rate ? (loan.principal_amount * rate).toFixed(2) : "")}
                            onChange={(e) => updateDisb(loan.id, "amount", e.target.value)}
                          />
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
