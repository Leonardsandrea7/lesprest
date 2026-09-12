import { useState, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { Button, Field, Input, Textarea, Alert } from "../../components/ui";

const VENEZUELA_STATES = [
  "Amazonas", "Anzoátegui", "Apure", "Aragua", "Barinas", "Bolívar", "Carabobo",
  "Cojedes", "Delta Amacuro", "Distrito Capital", "Falcón", "Guárico", "Lara",
  "Mérida", "Miranda", "Monagas", "Nueva Esparta", "Portuguesa", "Sucre",
  "Táchira", "Trujillo", "Vargas", "Yaracuy", "Zulia",
];

export function KycForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const [form, setForm] = useState({
    full_name: "", document_id: "", birth_date: "", state: VENEZUELA_STATES[0],
    city: "", address: "", whatsapp_number: "", extra_info: "",
  });
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
    const { error: insertError } = await supabase.from("kyc").insert({
      user_id: profile.id,
      ...form,
      status: "pendiente",
    });
    setLoading(false);
    if (insertError) {
      setError(insertError.message.includes("duplicate") ? "Ya tienes una verificación en curso." : insertError.message);
      return;
    }
    onDone();
  }

  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-[var(--ink)]">Verifica tu perfil</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">Necesitamos estos datos para poder aprobar tu préstamo.</p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <Field label="Nombre completo">
          <Input required value={form.full_name} onChange={(e) => update("full_name", e.target.value)} />
        </Field>
        <Field label="Cédula o documento de identidad">
          <Input required value={form.document_id} onChange={(e) => update("document_id", e.target.value)} />
        </Field>
        <Field label="Fecha de nacimiento">
          <Input required type="date" value={form.birth_date} onChange={(e) => update("birth_date", e.target.value)} />
        </Field>
        <Field label="Estado">
          <select
            required
            value={form.state}
            onChange={(e) => update("state", e.target.value)}
            className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-[15px] outline-none focus:border-[var(--brand)]"
          >
            {VENEZUELA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Ciudad">
          <Input required value={form.city} onChange={(e) => update("city", e.target.value)} />
        </Field>
        <Field label="Dirección">
          <Textarea required rows={2} value={form.address} onChange={(e) => update("address", e.target.value)} />
        </Field>
        <Field label="Número de WhatsApp" hint="Incluye el código de país, ej. +58 412 1234567">
          <Input required value={form.whatsapp_number} onChange={(e) => update("whatsapp_number", e.target.value)} placeholder="+58 412 1234567" />
        </Field>
        <Field label="Información adicional (opcional)">
          <Textarea rows={2} value={form.extra_info} onChange={(e) => update("extra_info", e.target.value)} />
        </Field>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Enviando..." : "Enviar para revisión"}
        </Button>
      </form>
    </div>
  );
}
