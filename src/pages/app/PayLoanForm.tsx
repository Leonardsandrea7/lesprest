import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import { notifyTelegram } from "../../lib/telegram";
import { Button, Card, Field, Input, Select, Alert } from "../../components/ui";
import { formatMoney, formatBs } from "../../lib/format";
import { useExchangeRate } from "../../lib/useExchangeRate";
import { useAuth } from "../../context/AuthContext";
import type { Loan, PlatformPaymentMethod } from "../../lib/database.types";

const BANKS = [
  "Banesco", "Banco de Venezuela", "Mercantil", "BNC", "Banco Provincial",
  "BOD", "Bancaribe", "Banplus", "Banco del Tesoro", "Bancamiga", "Otro",
];

export function PayLoanForm({ loan, onSubmitted }: { loan: Loan; onSubmitted: () => void }) {
  const [method, setMethod] = useState<PlatformPaymentMethod | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [bank, setBank] = useState(BANKS[0]);
  const [amount, setAmount] = useState(String(loan.total_amount - loan.amount_paid));
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const rate = useExchangeRate();
  const pendingAmount = loan.total_amount - loan.amount_paid;
  const { session } = useAuth();

  useEffect(() => {
    supabase
      .from("platform_payment_methods")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setMethod((data as PlatformPaymentMethod) ?? null));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: rpcError } = await supabase.rpc("submit_loan_payment", {
      p_loan_id: loan.id,
      p_bank: bank,
      p_amount: Number(amount),
      p_reference: reference.trim(),
      p_date: date,
    });
    setLoading(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    notifyTelegram(
      `💰 <b>Nuevo pago registrado</b>\n` +
        `Usuario: ${session?.user.email ?? "desconocido"}\n` +
        `Préstamo: ${loan.public_id}\n` +
        `Monto: ${formatMoney(Number(amount))}${rate ? ` (${formatBs(Number(amount), rate)})` : ""}\n` +
        `Referencia: ${reference.trim()}`
    );
    setSent(true);
    onSubmitted();
  }

  if (sent) {
    return (
      <Card>
        <p className="font-display text-lg font-semibold text-[var(--ink)]">Pago enviado</p>
        <p className="mt-1 text-sm text-[var(--muted)]">Estamos verificando tu operación. Te avisaremos por WhatsApp.</p>
      </Card>
    );
  }

  if (!showForm) {
    return (
      <Card>
        <h3 className="font-display text-lg font-semibold text-[var(--ink)]">Realiza tu pago</h3>
        {method ? (
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Banco" value={method.bank} />
            <Row label="Teléfono" value={method.phone} />
            <Row label="Cédula/RIF" value={method.document_id} />
            <Row label="Titular" value={method.holder_name} />
            <Row
              label="Monto a pagar"
              value={rate ? formatBs(pendingAmount, rate) : formatMoney(pendingAmount)}
              strong
            />
            {rate && <Row label="Equivalente" value={formatMoney(pendingAmount)} />}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-[var(--muted)]">No hay un método de pago activo configurado.</p>
        )}
        {method?.instructions && <p className="mt-3 text-sm text-[var(--muted)]">{method.instructions}</p>}
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-[var(--ink)]">
          <li>Realiza el Pago Móvil.</li>
          <li>Guarda el número de referencia.</li>
          <li>Introduce la referencia en el siguiente paso.</li>
          <li>Envía el pago para revisión.</li>
        </ol>
        <Button className="mt-5 w-full" disabled={!method} onClick={() => setShowForm(true)}>
          Ya realicé mi pago
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="font-display text-lg font-semibold text-[var(--ink)]">Registrar pago</h3>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <Field label="Banco desde el cual pagaste">
          <Select value={bank} onChange={(e) => setBank(e.target.value)}>
            {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
        </Field>
        <Field
          label="Monto (en dólares, según lo mostrado arriba)"
          hint={rate ? `Equivale a ${formatBs(Number(amount) || 0, rate)} al pagar` : undefined}
        >
          <Input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Número de referencia" hint="Debe ser único: no puedes repetir una referencia ya usada.">
          <Input required value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label="Fecha del pago">
          <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Enviando..." : "Enviar pago"}
        </Button>
      </form>
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className={`tabular ${strong ? "font-display font-semibold text-[var(--ink)]" : "text-[var(--ink)]"}`}>{value}</dd>
    </div>
  );
}
