import type { Kyc } from "../../lib/database.types";
import { Card, Alert } from "../../components/ui";
import { kycStatusLabels } from "../../lib/format";

export function KycStatusView({ kyc }: { kyc: Kyc }) {
  return (
    <Card>
      <h2 className="font-display text-lg font-semibold text-[var(--ink)]">Estado de tu verificación</h2>
      <p className="mt-2 text-sm font-semibold text-[var(--brand)]">{kycStatusLabels[kyc.status]}</p>
      {kyc.status === "en_revision" && (
        <Alert kind="info">Estamos revisando tu información. Te avisaremos por WhatsApp cuando esté lista.</Alert>
      )}
      {kyc.status === "rechazado" && (
        <Alert>Tu verificación no fue aprobada. Contáctanos por WhatsApp si tienes dudas.</Alert>
      )}
      {kyc.status === "requiere_informacion" && (
        <Alert kind="info">{kyc.review_notes || "Necesitamos información adicional. Te contactaremos por WhatsApp."}</Alert>
      )}
    </Card>
  );
}
