import { useState, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { Button, Field, Input, Alert } from "../../components/ui";

const BANKS = [
  "Banesco", "Banco de Venezuela", "Mercantil", "BNC", "Banco Provincial",
  "BOD", "Bancaribe", "Banplus", "Banco del Tesoro", "Bancamiga", "Otro",
];

export function PaymentMethodForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const [form, setForm] = useState({ bank: BANKS[0], holder_name: "", document_id: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setError(null);
    setLoading(true);
    const { error: insertError } = await supabase.from("user_payment_methods").insert({
      user_id: profile.id,
      ...form,
    });
    setLoading(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onDone();
  }

  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-[var(--ink)]">¿Dónde quieres recibir tu préstamo?</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">Estos datos se usarán para el desembolso por Pago Móvil.</p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <Field label="Banco">
          <select
            required
            value={form.bank}
            onChange={(e) => update("bank", e.target.value)}
            className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-[15px] outline-none focus:border-[var(--brand)]"
          >
            {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </Field>
        <Field label="Nombre del titular">
          <Input required value={form.holder_name} onChange={(e) => update("holder_name", e.target.value)} />
        </Field>
        <Field label="Documento (cédula/RIF)">
          <Input required value={form.document_id} onChange={(e) => update("document_id", e.target.value)} />
        </Field>
        <Field label="Teléfono asociado al Pago Móvil">
          <Input required value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="0412 1234567" />
        </Field>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Guardando..." : "Guardar datos"}
        </Button>
      </form>
    </div>
  );
}
