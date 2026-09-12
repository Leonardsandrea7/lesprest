import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Card, Badge, Button, EmptyState } from "../../components/ui";
import { formatMoney, formatDate, paymentStatusLabels } from "../../lib/format";
import { playSuccessSound } from "../../lib/sound";
import type { LoanPayment } from "../../lib/database.types";

const statusColors: Record<string, string> = {
  pendiente_verificacion: "bg-amber-100 text-amber-800",
  confirmado: "bg-blue-100 text-blue-800",
  rechazado: "bg-red-100 text-red-800",
};

interface PaymentRow extends LoanPayment {
  loans?: { public_id: string };
}

export function AdminPayments() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [filter, setFilter] = useState<"pendiente_verificacion" | "todos">("pendiente_verificacion");

  async function load() {
    let query = supabase
      .from("loan_payments")
      .select("*, loans(public_id)")
      .order("created_at", { ascending: false });
    if (filter === "pendiente_verificacion") query = query.eq("status", "pendiente_verificacion");
    const { data } = await query;
    setPayments((data as PaymentRow[]) ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function review(payment: LoanPayment, decision: "aprobar" | "rechazar") {
    const reason = decision === "rechazar" ? window.prompt("Motivo del rechazo:") ?? undefined : undefined;
    const { error } = await supabase.rpc("admin_review_payment", { p_payment_id: payment.id, p_decision: decision, p_reason: reason });
    if (error) return alert(error.message);
    if (decision === "aprobar") playSuccessSound();
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">Pagos</h1>
        <div className="flex gap-2 text-sm">
          <button onClick={() => setFilter("pendiente_verificacion")} className={filter === "pendiente_verificacion" ? "font-semibold text-[var(--brand)]" : "text-[var(--muted)]"}>Pendientes</button>
          <button onClick={() => setFilter("todos")} className={filter === "todos" ? "font-semibold text-[var(--brand)]" : "text-[var(--muted)]"}>Todos</button>
        </div>
      </div>

      {payments.length === 0 && <div className="mt-4"><EmptyState title="Sin pagos" body="No hay pagos que mostrar con este filtro." /></div>}

      <div className="mt-4 space-y-3">
        {payments.map((p) => (
          <Card key={p.id}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-[var(--ink)] tabular">{formatMoney(p.amount)} · {p.loans?.public_id}</p>
                <p className="text-xs text-[var(--muted)]">Ref. {p.reference_number} · {p.bank} · {formatDate(p.payment_date)}</p>
              </div>
              <Badge className={statusColors[p.status]}>{paymentStatusLabels[p.status]}</Badge>
            </div>
            {p.status === "pendiente_verificacion" && (
              <div className="mt-3 flex gap-2">
                <Button onClick={() => review(p, "aprobar")}>✓ Aprobar pago</Button>
                <Button variant="danger" onClick={() => review(p, "rechazar")}>✕ Rechazar pago</Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
