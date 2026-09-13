import { Card, Badge, Alert } from "../../components/ui";
import { formatMoney, formatDate, loanStatusLabels, loanStatusColors, installmentStatusLabels, installmentStatusColors } from "../../lib/format";
import type { Loan, LoanInstallment } from "../../lib/database.types";
import { PayLoanForm } from "./PayLoanForm";

export function LoanInProgressView({
  loan,
  installments,
  onPaid,
}: {
  loan: Loan;
  installments: LoanInstallment[];
  onPaid: () => void;
}) {
  const pending = loan.total_amount - loan.amount_paid;
  const usesInstallments = loan.installments_count > 1;
  const nextInstallment = installments.find((i) => i.status === "pendiente" || i.status === "vencida");

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center justify-between">
          <span className="font-display text-lg font-semibold text-[var(--ink)]">{loan.public_id}</span>
          <Badge className={loanStatusColors[loan.status]}>{loanStatusLabels[loan.status]}</Badge>
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Préstamo" value={formatMoney(loan.principal_amount)} />
          <Row label="Total a devolver" value={formatMoney(loan.total_amount)} />
          <Row label="Pendiente" value={formatMoney(pending)} strong />
          {!usesInstallments && loan.due_at && <Row label="Vencimiento" value={formatDate(loan.due_at)} />}
        </dl>
      </Card>

      {usesInstallments && installments.length > 0 && (
        <Card>
          <p className="font-display text-base font-semibold text-[var(--ink)]">
            Calendario de pagos ({loan.installments_count} cuotas)
          </p>
          <div className="mt-3 space-y-3">
            {installments.map((inst) => (
              <div key={inst.id} className="flex items-center justify-between border-b border-[var(--line)] pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-[var(--ink)]">Cuota {inst.installment_number}</p>
                  <p className="text-xs text-[var(--muted)]">Vence {formatDate(inst.due_at)}</p>
                </div>
                <div className="text-right">
                  <p className="tabular text-sm font-semibold text-[var(--ink)]">{formatMoney(inst.amount)}</p>
                  <Badge className={installmentStatusColors[inst.status]}>{installmentStatusLabels[inst.status]}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {["solicitado", "en_revision"].includes(loan.status) && (
        <Alert kind="info">Tu solicitud está en revisión. Te avisaremos cuando sea aprobada.</Alert>
      )}
      {["aprobado", "pendiente_desembolso"].includes(loan.status) && (
        <Alert kind="info">Tu préstamo fue aprobado. Estamos procesando el desembolso a tu Pago Móvil.</Alert>
      )}
      {loan.status === "pendiente_pago" && (
        <Alert kind="info">Recibimos tu pago y lo estamos verificando. Esto puede tardar unas horas.</Alert>
      )}
      {loan.status === "vencido" && (
        <Alert>Tu préstamo está vencido. Realiza tu pago cuanto antes para evitar restricciones en tu cuenta.</Alert>
      )}

      {(loan.status === "activo" || loan.status === "vencido") && !usesInstallments && (
        <PayLoanForm loan={loan} onSubmitted={onPaid} />
      )}

      {(loan.status === "activo" || loan.status === "vencido") && usesInstallments && nextInstallment && (
        <PayLoanForm loan={loan} installment={nextInstallment} onSubmitted={onPaid} />
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className={`tabular ${strong ? "font-display text-base font-semibold text-[var(--ink)]" : "text-[var(--ink)]"}`}>{value}</dd>
    </div>
  );
}
