import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useUserLoanData } from "../../lib/useUserLoanData";
import { Card, Badge, ProgressBar } from "../../components/ui";
import { formatMoney, formatBs, formatDate, loanStatusLabels, loanStatusColors, daysRemaining } from "../../lib/format";
import { useExchangeRate } from "../../lib/useExchangeRate";
import { useInstallPrompt } from "../../lib/useInstallPrompt";

export function Dashboard() {
  const { profile } = useAuth();
  const { loading, error, currentLevel, kyc, paymentMethod, activeLoan, refresh } = useUserLoanData();
  const rate = useExchangeRate();
  const { canInstall, isStandalone, promptInstall } = useInstallPrompt();

  const firstName = kyc?.full_name?.split(" ")[0] ?? profile?.full_name?.split(" ")[0] ?? null;

  if (loading) {
    return <div className="py-10 text-center text-sm text-[var(--muted)]">Cargando tu cuenta...</div>;
  }

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
    <div className="space-y-5">
      <div>
        <p className="text-sm text-[var(--muted)]">Bienvenido de nuevo</p>
        <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">
          {firstName ? `Hola, ${firstName}` : "Hola de nuevo"}
        </h1>
      </div>

      {!isStandalone && canInstall && (
        <button
          onClick={promptInstall}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] py-3 text-[15px] font-semibold text-white hover:bg-[var(--brand-dark)]"
        >
          ⬇ Instalar la app LES PREST
        </button>
      )}

      {currentLevel && (
        <div className="balance-card rounded-3xl p-6 text-white">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white/70">Crédito disponible</span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Nivel {currentLevel.level_number}</span>
          </div>
          <p className="mt-4 font-display text-4xl font-extrabold tabular">
            {formatMoney(currentLevel.principal_amount)}
          </p>
          {rate ? <p className="mt-1 text-sm text-white/70 tabular">{formatBs(currentLevel.principal_amount, rate)}</p> : null}

          {!activeLoan && (
            <Link
              to="/app/prestamo"
              className="mt-6 block rounded-xl bg-white py-3 text-center text-[15px] font-semibold text-[var(--brand-dark)] hover:bg-white/90"
            >
              Solicitar préstamo
            </Link>
          )}
        </div>
      )}

      {activeLoan && (
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--muted)]">Préstamo activo · {activeLoan.public_id}</span>
            <Badge className={loanStatusColors[activeLoan.status]}>{loanStatusLabels[activeLoan.status]}</Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-[var(--muted)]">Debes pagar</p>
              <p className="font-display text-xl font-semibold tabular">{formatMoney(activeLoan.total_amount - activeLoan.amount_paid)}</p>
              {rate ? <p className="text-xs text-[var(--muted)] tabular">{formatBs(activeLoan.total_amount - activeLoan.amount_paid, rate)}</p> : null}
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Vencimiento</p>
              <p className="font-display text-xl font-semibold tabular">{formatDate(activeLoan.due_at)}</p>
              {activeLoan.due_at && daysRemaining(activeLoan.due_at) !== null && (
                <p className="text-xs text-[var(--muted)]">
                  {(daysRemaining(activeLoan.due_at) as number) >= 0
                    ? `${daysRemaining(activeLoan.due_at)} días restantes`
                    : "Vencido"}
                </p>
              )}
            </div>
          </div>
          <Link
            to="/app/prestamo"
            className="mt-4 block rounded-xl border border-[var(--line)] py-3 text-center text-[15px] font-semibold text-[var(--ink)] hover:border-[var(--brand)]"
          >
            Ver detalle
          </Link>
        </Card>
      )}

      {currentLevel && (
        <Card>
          <p className="text-sm font-medium text-[var(--muted)]">Progreso de nivel</p>
          <div className="mt-3">
            <ProgressBar value={profile?.loans_completed_current_level ?? 0} max={currentLevel.loans_required_to_unlock_next} />
          </div>
          <p className="mt-2 text-sm text-[var(--ink)]">
            {profile?.loans_completed_current_level ?? 0} / {currentLevel.loans_required_to_unlock_next} préstamos completados
          </p>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between py-1">
          <span className="text-sm text-[var(--ink)]">KYC</span>
          <StatusPill ok={kyc?.status === "aprobado"} okText="Verificado" pendingText={kyc ? kycLabel(kyc.status) : "No iniciado"} />
        </div>
        <div className="mt-2 flex items-center justify-between py-1">
          <span className="text-sm text-[var(--ink)]">Pago Móvil</span>
          <StatusPill ok={!!paymentMethod} okText="Registrado" pendingText="Pendiente" />
        </div>
      </Card>
    </div>
  );
}

function kycLabel(status: string) {
  const map: Record<string, string> = {
    pendiente: "Pendiente",
    en_revision: "En revisión",
    rechazado: "Rechazado",
    requiere_informacion: "Requiere información",
  };
  return map[status] ?? status;
}

function StatusPill({ ok, okText, pendingText }: { ok: boolean; okText: string; pendingText: string }) {
  return ok ? (
    <span className="text-sm font-semibold text-[var(--success)]">✓ {okText}</span>
  ) : (
    <span className="text-sm font-medium text-[var(--muted)]">{pendingText}</span>
  );
}
