import type { Kyc } from "../../lib/database.types";
import { Card, Alert } from "../../components/ui";
import { kycStatusLabels } from "../../lib/format";

export function KycStatusView({ kyc }: { kyc: Kyc }) {
  return (
    <Card>
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand)]/10 text-[var(--brand)]">
          {kyc.status === "aprobado" ? <CheckIcon /> : kyc.status === "rechazado" ? <XIcon /> : <ClockIcon />}
        </div>
      </div>
      <h2 className="mt-4 text-center font-display text-lg font-semibold text-[var(--ink)]">
        {kycStatusLabels[kyc.status]}
      </h2>

      <div className="mt-4">
        {kyc.status === "en_revision" && (
          <Alert kind="info">Estamos revisando tu información. Te avisaremos por WhatsApp cuando esté lista.</Alert>
        )}
        {kyc.status === "pendiente" && (
          <Alert kind="info">Recibimos tus datos. Los revisaremos y te avisaremos por WhatsApp. Normalmente toma unas horas.</Alert>
        )}
        {kyc.status === "rechazado" && (
          <Alert>Tu verificación no fue aprobada. Contáctanos por WhatsApp si tienes dudas.</Alert>
        )}
        {kyc.status === "requiere_informacion" && (
          <Alert kind="info">{kyc.review_notes || "Necesitamos información adicional. Te contactaremos por WhatsApp."}</Alert>
        )}
      </div>
    </Card>
  );
}

function ClockIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7v5.2l3.2 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 12.3l2.7 2.7L16 9.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}
