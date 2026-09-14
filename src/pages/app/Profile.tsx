import { useAuth } from "../../context/AuthContext";
import { useUserLoanData } from "../../lib/useUserLoanData";
import { usePushSubscription } from "../../lib/usePushSubscription";
import { Card, Button, Alert } from "../../components/ui";
import { kycStatusLabels } from "../../lib/format";

export function Profile() {
  const { profile } = useAuth();
  const { kyc, paymentMethod } = useUserLoanData();
  const { status, message, activate } = usePushSubscription();

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">Perfil</h1>

      <Card>
        <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Correo</p>
        <p className="mt-1 text-[15px] text-[var(--ink)]">{profile?.id ? "Sesión activa" : "—"}</p>
      </Card>

      <Card>
        <p className="text-sm font-semibold text-[var(--ink)]">Notificaciones</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Recibe avisos de tus préstamos y novedades de LES PREST, aunque no tengas la app abierta.
        </p>
        {status === "activo" ? (
          <p className="mt-3 text-sm font-semibold text-[var(--brand)]">✓ Notificaciones activadas</p>
        ) : (
          <Button className="mt-3" onClick={() => profile && activate(profile.id)} disabled={status === "requesting"}>
            {status === "requesting" ? "Activando..." : "Activar notificaciones"}
          </Button>
        )}
        {message && status !== "activo" && <div className="mt-3"><Alert kind={status === "error" ? "error" : "info"}>{message}</Alert></div>}
      </Card>

      <Card>
        <p className="text-sm font-semibold text-[var(--ink)]">Verificación (KYC)</p>
        <p className="mt-1 text-sm text-[var(--muted)]">{kyc ? kycStatusLabels[kyc.status] : "No iniciado"}</p>
      </Card>

      <Card>
        <p className="text-sm font-semibold text-[var(--ink)]">Datos de Pago Móvil</p>
        {paymentMethod ? (
          <div className="mt-2 space-y-1 text-sm text-[var(--muted)]">
            <p>{paymentMethod.bank} · {paymentMethod.phone}</p>
            <p>{paymentMethod.holder_name} · {paymentMethod.document_id}</p>
            {paymentMethod.is_locked && (
              <p className="text-xs text-amber-700">Bloqueado mientras tienes un préstamo en curso.</p>
            )}
          </div>
        ) : (
          <p className="mt-1 text-sm text-[var(--muted)]">Aún no registras tus datos de Pago Móvil.</p>
        )}
      </Card>
    </div>
  );
}
