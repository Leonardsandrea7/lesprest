import { useUserLoanData } from "../../lib/useUserLoanData";
import { Card, Badge, EmptyState } from "../../components/ui";
import { formatMoney, formatDate, paymentStatusLabels } from "../../lib/format";

const statusColors: Record<string, string> = {
  pendiente_verificacion: "bg-amber-100 text-amber-800",
  confirmado: "bg-emerald-100 text-emerald-800",
  rechazado: "bg-red-100 text-red-800",
};

export function PaymentsHistory() {
  const { loading, error, payments, refresh } = useUserLoanData();

  if (loading) return <div className="py-10 text-center text-sm text-[var(--muted)]">Cargando...</div>;

  if (error) {
    return (
      <div className="space-y-3 py-10 text-center">
        <p className="text-sm text-[var(--brick)]">{error}</p>
        <button onClick={refresh} className="text-sm font-semibold text-[var(--brand)] underline">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">Tus pagos</h1>
      {payments.length === 0 && <EmptyState title="Aún no tienes pagos" body="Cuando realices un pago, aparecerá aquí." />}
      {payments.map((p) => (
        <Card key={p.id}>
          <div className="flex items-center justify-between">
            <span className="font-display font-semibold text-[var(--ink)] tabular">{formatMoney(p.amount)}</span>
            <Badge className={statusColors[p.status]}>{paymentStatusLabels[p.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">Ref. {p.reference_number} · {formatDate(p.payment_date)}</p>
          {p.status === "rechazado" && p.rejection_reason && (
            <p className="mt-2 text-sm text-[var(--brick)]">{p.rejection_reason}</p>
          )}
        </Card>
      ))}
    </div>
  );
}
