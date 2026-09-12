import { useUserLoanData } from "../../lib/useUserLoanData";
import { KycForm } from "./KycForm";
import { KycStatusView } from "./KycStatusView";
import { TermsAcceptance } from "./TermsAcceptance";
import { PaymentMethodForm } from "./PaymentMethodForm";
import { LoanRequestConfirm } from "./LoanRequestConfirm";
import { LoanInProgressView } from "./LoanInProgressView";
import { EmptyState } from "../../components/ui";

export function LoanFlow() {
  const data = useUserLoanData();

  if (data.loading) {
    return <div className="py-10 text-center text-sm text-[var(--muted)]">Cargando...</div>;
  }

  if (data.error) {
    return (
      <div className="space-y-3 py-10 text-center">
        <p className="text-sm text-[var(--brick)]">{data.error}</p>
        <button onClick={data.refresh} className="text-sm font-semibold text-[var(--brand)] underline">
          Reintentar
        </button>
      </div>
    );
  }

  // 1) Préstamo en curso: mostrarlo siempre primero, sin importar el resto.
  if (data.activeLoan) {
    return <LoanInProgressView loan={data.activeLoan} onPaid={data.refresh} />;
  }

  // 2) KYC no iniciado
  if (!data.kyc) {
    return <KycForm onDone={data.refresh} />;
  }

  // 3) KYC no aprobado aún
  if (data.kyc.status !== "aprobado") {
    return <KycStatusView kyc={data.kyc} />;
  }

  // 4) Términos no aceptados
  if (!data.hasAcceptedTerms) {
    return <TermsAcceptance onDone={data.refresh} />;
  }

  // 5) Pago Móvil no registrado
  if (!data.paymentMethod) {
    return <PaymentMethodForm onDone={data.refresh} />;
  }

  // 6) Todo listo: mostrar confirmación de solicitud
  if (data.currentLevel) {
    return <LoanRequestConfirm level={data.currentLevel} onRequested={data.refresh} />;
  }

  return <EmptyState title="Sin nivel disponible" body="Contacta a soporte para activar tu cuenta." />;
}
