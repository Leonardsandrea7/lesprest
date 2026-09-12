import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Card, Button, Field, Input, Textarea, Alert } from "../../components/ui";
import type { PlatformPaymentMethod } from "../../lib/database.types";

type FormState = Omit<PlatformPaymentMethod, "id">;

const EMPTY_FORM: FormState = {
  bank: "",
  phone: "",
  document_id: "",
  holder_name: "",
  instructions: "",
  is_active: true,
};

export function AdminPaymentMethods() {
  const [existingId, setExistingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErrorMsg(null);
    const { data, error } = await supabase
      .from("platform_payment_methods")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      setErrorMsg(error.message);
    } else if (data) {
      const row = data as PlatformPaymentMethod;
      setExistingId(row.id);
      setForm({
        bank: row.bank,
        phone: row.phone,
        document_id: row.document_id,
        holder_name: row.holder_name,
        instructions: row.instructions ?? "",
        is_active: row.is_active,
      });
    } else {
      setExistingId(null);
      setForm(EMPTY_FORM);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    setErrorMsg(null);

    // El campo "id" nunca se incluye en el cuerpo enviado: en creación lo
    // genera la base de datos automáticamente, y en actualización se usa
    // únicamente en el .eq(), nunca dentro del objeto a guardar. Así se
    // evita por completo el error "invalid input syntax for type uuid".
    if (existingId) {
      const { error } = await supabase.from("platform_payment_methods").update(form).eq("id", existingId);
      if (error) {
        setErrorMsg(error.message);
      } else {
        setMessage("Datos actualizados correctamente.");
      }
    } else {
      const { data, error } = await supabase.from("platform_payment_methods").insert(form).select().single();
      if (error) {
        setErrorMsg(error.message);
      } else {
        setExistingId((data as PlatformPaymentMethod).id);
        setMessage("Método de pago creado correctamente.");
      }
    }
    setSaving(false);
  }

  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Cargando...</p>;
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">Pago Móvil de LES PREST</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {existingId
          ? "Estos datos se muestran a los usuarios cuando van a pagar su cuota."
          : "Aún no hay un Pago Móvil oficial configurado. Completa el formulario para crearlo."}
      </p>

      {errorMsg && <div className="mt-4"><Alert>{errorMsg}</Alert></div>}

      <Card className="mt-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Banco">
            <Input value={form.bank} onChange={(e) => updateField("bank", e.target.value)} />
          </Field>
          <Field label="Teléfono">
            <Input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
          </Field>
          <Field label="Cédula/RIF">
            <Input value={form.document_id} onChange={(e) => updateField("document_id", e.target.value)} />
          </Field>
          <Field label="Nombre del titular">
            <Input value={form.holder_name} onChange={(e) => updateField("holder_name", e.target.value)} />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Instrucciones">
            <Textarea rows={3} value={form.instructions ?? ""} onChange={(e) => updateField("instructions", e.target.value)} />
          </Field>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-[var(--ink)]">
          <input type="checkbox" checked={form.is_active} onChange={(e) => updateField("is_active", e.target.checked)} />
          Activo
        </label>
        {message && <div className="mt-4"><Alert kind="success">{message}</Alert></div>}
        <Button className="mt-4" disabled={saving} onClick={save}>
          {saving ? "Guardando..." : existingId ? "Guardar cambios" : "Crear método de pago"}
        </Button>
      </Card>
    </div>
  );
}
