import { useEffect, useState, type FormEvent } from "react";
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

const DRAFT_KEY = "lp_kyc_draft";
const TOTAL_STEPS = 4;

type FormState = {
  full_name: string; document_id: string; birth_date: string; state: string;
  city: string; address: string; whatsapp_number: string; extra_info: string;
};

const EMPTY_FORM: FormState = {
  full_name: "", document_id: "", birth_date: "", state: VENEZUELA_STATES[0],
  city: "", address: "", whatsapp_number: "", extra_info: "",
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type });
}

export function KycForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [idPhoto, setIdPhoto] = useState<File | null>(null);
  const [selfiePhoto, setSelfiePhoto] = useState<File | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) {
      setRestored(true);
      return;
    }
    try {
      const draft = JSON.parse(raw);
      if (draft.form) setForm(draft.form);
      if (draft.step) setStep(draft.step);
      (async () => {
        if (draft.idPhotoDataUrl) {
          setIdPhoto(await dataUrlToFile(draft.idPhotoDataUrl, "cedula.jpg"));
          setIdPreview(draft.idPhotoDataUrl);
        }
        if (draft.selfiePhotoDataUrl) {
          setSelfiePhoto(await dataUrlToFile(draft.selfiePhotoDataUrl, "selfie.jpg"));
          setSelfiePreview(draft.selfiePhotoDataUrl);
        }
        setRestored(true);
      })();
    } catch {
      setRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!restored) return;
    sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ form, step, idPhotoDataUrl: idPreview, selfiePhotoDataUrl: selfiePreview })
    );
  }, [form, step, idPreview, selfiePreview, restored]);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handlePhotoSelected(file: File | undefined, kind: "id" | "selfie") {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    if (kind === "id") {
      setIdPhoto(file);
      setIdPreview(dataUrl);
    } else {
      setSelfiePhoto(file);
      setSelfiePreview(dataUrl);
    }
  }

  async function uploadPhoto(file: File, kind: "cedula" | "selfie"): Promise<string> {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${profile!.id}/${kind}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("kyc-documents").upload(path, file);
    if (uploadError) throw uploadError;
    return path;
  }

  function validateStep(): string | null {
    if (step === 1) {
      if (!form.full_name || !form.document_id || !form.birth_date) return "Completa nombre, cédula y fecha de nacimiento.";
    }
    if (step === 2) {
      if (!form.city || !form.address) return "Completa ciudad y dirección.";
    }
    if (step === 3) {
      if (!form.whatsapp_number) return "Ingresa tu número de WhatsApp.";
    }
    return null;
  }

  function goNext() {
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 1));
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

      sessionStorage.removeItem(DRAFT_KEY);
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
      <p className="mt-1 text-sm text-[var(--muted)]">Paso {step} de {TOTAL_STEPS}</p>

      <div className="mt-3 flex gap-1.5">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-[var(--brand)]" : "bg-[var(--line)]"}`}
          />
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {step === 1 && (
          <>
            <Field label="Nombre completo">
              <Input required value={form.full_name} onChange={(e) => update("full_name", e.target.value)} />
            </Field>
            <Field label="Cédula o documento de identidad">
              <Input required value={form.document_id} onChange={(e) => update("document_id", e.target.value)} />
            </Field>
            <Field label="Fecha de nacimiento">
              <Input required type="date" value={form.birth_date} onChange={(e) => update("birth_date", e.target.value)} />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
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
          </>
        )}

        {step === 3 && (
          <>
            <Field label="Número de WhatsApp" hint="Incluye el código de país, ej. +58 412 1234567">
              <Input required value={form.whatsapp_number} onChange={(e) => update("whatsapp_number", e.target.value)} placeholder="+58 412 1234567" />
            </Field>
            <Field label="Información adicional (opcional)">
              <Textarea rows={2} value={form.extra_info} onChange={(e) => update("extra_info", e.target.value)} />
            </Field>
          </>
        )}

        {step === 4 && (
          <div className="grid grid-cols-2 gap-3">
            <PhotoPickerCard
              label="Foto de tu cédula"
              icon={<IdCardIcon />}
              preview={idPreview}
              capture="environment"
              onSelect={(f) => handlePhotoSelected(f, "id")}
            />
            <PhotoPickerCard
              label="Selfie con tu cédula"
              icon={<SelfieIcon />}
              preview={selfiePreview}
              capture="user"
              onSelect={(f) => handlePhotoSelected(f, "selfie")}
            />
          </div>
        )}

        {error && <Alert>{error}</Alert>}

        <div className="flex gap-3 pt-2">
          {step > 1 && (
            <Button type="button" variant="secondary" onClick={goBack} className="flex-1">
              Atrás
            </Button>
          )}
          {step < TOTAL_STEPS ? (
            <Button type="button" onClick={goNext} className="flex-[2]">
              Siguiente
            </Button>
          ) : (
            <Button type="submit" disabled={loading} className="flex-[2]">
              {loading ? "Enviando..." : "Enviar para revisión"}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function PhotoPickerCard({
  label,
  icon,
  preview,
  capture,
  onSelect,
}: {
  label: string;
  icon: React.ReactNode;
  preview: string | null;
  capture: "environment" | "user";
  onSelect: (file: File | undefined) => void;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--line)] bg-[var(--paper-raised)] p-4 text-center transition-colors hover:border-[var(--brand)]">
      {preview ? (
        <img src={preview} alt={label} className="h-24 w-full rounded-xl object-cover" />
      ) : (
        <div className="flex h-24 w-full items-center justify-center rounded-xl bg-[var(--brand)]/10 text-[var(--brand)]">
          {icon}
        </div>
      )}
      <span className="text-xs font-medium text-[var(--ink)]">{label}</span>
      <span className="text-[11px] font-semibold text-[var(--brand)]">
        {preview ? "Cambiar foto" : "Tomar foto"}
      </span>
      {failed && <span className="text-[11px] font-medium text-[var(--brick)]">No se detectó la foto, intenta de nuevo</span>}
      <input
        type="file"
        accept="image/*"
        capture={capture}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          setFailed(!file);
          onSelect(file);
          // Permite volver a elegir el mismo archivo (o reintentar) sin
          // que el navegador ignore el segundo intento.
          e.target.value = "";
        }}
      />
    </label>
  );
}

function IdCardIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <rect x="2.5" y="5" width="19" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8" cy="11" r="1.8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 15.5c0-1.4 1.3-2.3 3-2.3s3 .9 3 2.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M13.5 10h5M13.5 13h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function SelfieIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 15c0-1.8 2-2.8 5-2.8s5 1 5 2.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="18" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}
