import { useState, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { notifyTelegram, notifyTelegramPhoto } from "../../lib/telegram";
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
  const [idPhoto, setIdPhoto] = useState<File | null>(null);
  const [selfiePhoto, setSelfiePhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function uploadPhoto(file: File, kind: "cedula" | "selfie"): Promise<string> {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${profile!.id}/${kind}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("kyc-documents").upload(path, file);
    if (uploadError) throw uploadError;
    return path;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (!idPhoto || !selfiePhoto) {
      setError("Debes tomar la foto de tu cédula y una selfie.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const [idPhotoPath, selfiePhotoPath] = await Promise.all([
        uploadPhoto(idPhoto, "cedula"),
        uploadPhoto(selfiePhoto, "selfie"),
      ]);

      const { error: insertError } = await supabase.from("kyc").insert({
        user_id: profile.id,
        ...form,
        id_photo_path: idPhotoPath,
        selfie_photo_path: selfiePhotoPath,
        status: "pendiente",
      });
      if (insertError) throw insertError;

      // Generar URLs temporales (5 minutos) solo para que Telegram pueda
      // descargar las imágenes al momento de enviarlas. No quedan públicas.
      const [{ data: idUrl }, { data: selfieUrl }] = await Promise.all([
        supabase.storage.from("kyc-documents").createSignedUrl(idPhotoPath, 300),
        supabase.storage.from("kyc-documents").createSignedUrl(selfiePhotoPath, 300),
      ]);

      const caption =
        `🆔 <b>Nuevo usuario registrado — KYC</b>\n` +
        `Nombre: ${form.full_name}\n` +
        `Cédula: ${form.document_id}\n` +
        `Fecha de nacimiento: ${form.birth_date}\n` +
        `Estado: ${form.state}\n` +
        `Ciudad: ${form.city}\n` +
        `Dirección: ${form.address}\n` +
        `WhatsApp: ${form.whatsapp_number}` +
        (form.extra_info ? `\nInfo adicional: ${form.extra_info}` : "");

      if (idUrl?.signedUrl) {
        await notifyTelegramPhoto(idUrl.signedUrl, caption);
      } else {
        await notifyTelegram(caption);
      }
      if (selfieUrl?.signedUrl) {
        await notifyTelegramPhoto(selfieUrl.signedUrl, "👤 Selfie de verificación");
      }
    } catch (err: any) {
      setLoading(false);
      setError(err?.message?.includes("duplicate") ? "Ya tienes una verificación en curso." : err?.message ?? "Ocurrió un error al enviar tu verificación.");
      return;
    }

    setLoading(false);
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
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] px-4 py-3 text-[15px] outline-none focus:border-[var(--brand)]"
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

        <Field label="Foto de tu cédula (frente)" hint="Toca para abrir la cámara">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            required
            onChange={(e) => setIdPhoto(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-[var(--ink)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--brand)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
          />
          {idPhoto && <p className="mt-1 text-xs text-[var(--success,var(--brand))]">✓ Foto lista: {idPhoto.name}</p>}
        </Field>

        <Field label="Selfie sosteniendo tu cédula" hint="Toca para abrir la cámara frontal">
          <input
            type="file"
            accept="image/*"
            capture="user"
            required
            onChange={(e) => setSelfiePhoto(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-[var(--ink)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--brand)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
          />
          {selfiePhoto && <p className="mt-1 text-xs text-[var(--brand)]">✓ Foto lista: {selfiePhoto.name}</p>}
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
