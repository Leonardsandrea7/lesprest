import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { notifyTelegram } from "../../lib/telegram";
import { Button, Card, Alert } from "../../components/ui";
import { formatMoney, formatBs } from "../../lib/format";
import { useExchangeRate } from "../../lib/useExchangeRate";
import { useAuth } from "../../context/AuthContext";
import type { LoanLevel } from "../../lib/database.types";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";

export function LoanRequestConfirm({ level, onRequested }: { level: LoanLevel; onRequested: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rate = useExchangeRate();
  const { session } = useAuth();

  const choices = level.allow_installments && level.installment_choices?.length ? level.installment_choices : [1];
  const [installments, setInstallments] = useState<number>(choices[0]);

  const returnAmount = Math.round(level.principal_amount * (level.return_rate_percent / 100) * 100) / 100;
  const total = level.principal_amount + returnAmount;
  const perInstallment = Math.round((total / installments) * 100) / 100;
  const totalDays = level.term_days * installments;
  const estimatedDue = format(addDays(new Date(), totalDays), "dd 'de' MMMM", { locale: es });

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    const { data: loan, error: rpcError } = await supabase.rpc("request_loan", { p_installments: installments });
    setLoading(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    const [{ data: kycData }, { data: upmData }] = await Promise.all([
      supabase
        .from("kyc")
        .select("full_name, document_id, whatsapp_number")
        .eq("user_id", session?.user.id ?? "")
        .eq("status", "aprobado")
        .order("reviewed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("user_payment_methods")
        .select("bank, holder_name, document_id, phone")
        .eq("user_id", session?.user.id ?? "")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const kyc = kycData as { full_name: string; document_id: string; whatsapp_number: string } | null;
    const upm = upmData as { bank: string; holder_name: string; document_id: string; phone: string } | null;

    notifyTelegram(
      `🆕 <b>Nueva solicitud de préstamo</b>\n` +
        `Nombre: ${kyc?.full_name ?? "desconocido"}\n` +
        `Cédula: ${kyc?.document_id ?? "desconocida"}\n` +
        `WhatsApp: ${kyc?.whatsapp_number ?? "—"}\n` +
        `Usuario: ${session?.user.email ?? "desconocido"}\n` +
        `Nivel: ${level.level_number}\n` +
        `Monto a desembolsar: ${formatMoney(level.principal_amount)}${rate ? ` (${formatBs(level.principal_amount, rate)})` : ""}\n` +
        `Cuotas elegidas: ${installments}\n` +
        `ID: ${(loan as { public_id?: string } | null)?.public_id ?? ""}\n\n` +
        `<b>Datos de Pago Móvil para el desembolso:</b>\n` +
        `Banco: ${upm?.bank ?? "—"}\n` +
        `Titular: ${upm?.holder_name ?? "—"}\n` +
        `Documento: ${upm?.document_id ?? "—"}\n` +
        `Teléfono: ${upm?.phone ?? "—"}`
    );
    onRequested();
  }

  return (
    <Card>
      <p className="text-sm font-medium text-[var(--muted)]">Nivel {level.level_number}</p>
      <p className="mt-1 font-display text-3xl font-semibold text-[var(--ink)] tabular">{formatMoney(level.principal_amount)}</p>
      {rate && <p className="text-sm text-[var(--muted)] tabular">{formatBs(level.principal_amount, rate)}</p>}

      {choices.length > 1 && (
        <div className="mt-4 border-t border-[var(--line)] pt-4">
          <p className="text-sm font-medium text-[var(--ink)]">¿En cuántas cuotas quieres pagar?</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {choices.map((n) => (
              <button
                key={n}
                onClick={() => setInstallments(n)}
                className={`rounded-xl border py-2.5 text-center text-sm font-semibold transition-colors ${
                  installments === n
                    ? "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]"
                    : "border-[var(--line)] text-[var(--muted)]"
                }`}
              >
                <span className="block">{n === 1 ? "Todo junto" : `${n} cuotas`}</span>
                <span className="block text-[11px] font-normal opacity-70">{level.term_days * n} días</span>
              </button>
            ))}
          </div>
          {installments > 1 && (
            <p className="mt-2 text-sm text-[var(--muted)] tabular">
              {installments} pagos de {formatMoney(perInstallment)}{rate ? ` (${formatBs(perInstallment, rate)})` : ""} cada uno
            </p>
          )}
        </div>
      )}

      <dl className="mt-4 space-y-2 border-t border-[var(--line)] pt-4 text-sm">
        <Row label="Total a devolver" value={formatMoney(total)} sub={rate ? formatBs(total, rate) : undefined} strong />
        <Row label="Plazo total" value={`${totalDays} días`} />
        <Row label="Fecha estimada de vencimiento" value={estimatedDue} />
      </dl>

      {error && <div className="mt-4"><Alert>{error}</Alert></div>}

      <Button onClick={handleConfirm} disabled={loading} className="mt-5 w-full">
        {loading ? "Enviando solicitud..." : "Confirmar solicitud"}
      </Button>
    </Card>
  );
}

function Row({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="text-right">
        <div className={`tabular ${strong ? "font-display text-base font-semibold text-[var(--ink)]" : "text-[var(--ink)]"}`}>{value}</div>
        {sub && <div className="text-xs text-[var(--muted)] tabular">{sub}</div>}
      </dd>
    </div>
  );
}
