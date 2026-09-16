import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { Button, Card, Alert } from "../../components/ui";

export function TermsAcceptance({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const [checks, setChecks] = useState({ terms: false, privacy: false, truthful: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFull, setShowFull] = useState(false);
  const [fullText, setFullText] = useState<string | null>(null);

  useEffect(() => {
    if (!showFull || fullText) return;
    supabase
      .from("legal_documents")
      .select("content")
      .eq("doc_type", "terminos")
      .eq("is_current", true)
      .maybeSingle()
      .then(({ data }) => setFullText((data as { content: string } | null)?.content ?? "No hay documento disponible."));
  }, [showFull, fullText]);

  const allChecked = checks.terms && checks.privacy && checks.truthful;

  async function handleAccept() {
    if (!profile) return;
    setLoading(true);
    setError(null);

    const { data: doc } = await supabase
      .from("legal_documents")
      .select("id")
      .eq("doc_type", "terminos")
      .eq("is_current", true)
      .maybeSingle();

    if (!doc) {
      setError("No hay un documento de términos configurado. Contacta al administrador.");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("terms_acceptance").insert({
      user_id: profile.id,
      document_id: doc.id,
    });
    setLoading(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onDone();
  }

  return (
    <Card>
      <h2 className="font-display text-lg font-semibold text-[var(--ink)]">Antes de continuar</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">Esto es lo que estás aceptando, en pocas palabras:</p>

      <ul className="mt-4 space-y-2.5 text-sm text-[var(--ink)]">
        <li className="flex gap-2">
          <span className="text-[var(--brand)]">•</span>
          Te comprometes a devolver el monto total en la fecha indicada.
        </li>
        <li className="flex gap-2">
          <span className="text-[var(--brand)]">•</span>
          Si no pagas dentro del plazo más 3 días de prórroga, tu cédula queda bloqueada para futuros préstamos.
        </li>
        <li className="flex gap-2">
          <span className="text-[var(--brand)]">•</span>
          La información que diste es verdadera y podemos contactarte por WhatsApp.
        </li>
      </ul>

      <button
        type="button"
        onClick={() => setShowFull((v) => !v)}
        className="mt-3 text-sm font-semibold text-[var(--brand)] underline"
      >
        {showFull ? "Ocultar documento completo" : "Leer el documento completo"}
      </button>

      {showFull && (
        <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4 text-xs leading-relaxed text-[var(--muted)] whitespace-pre-wrap">
          {fullText ?? "Cargando documento..."}
        </div>
      )}

      <div className="mt-5 space-y-3 border-t border-[var(--line)] pt-4">
        <CheckRow label="Acepto los términos y condiciones." checked={checks.terms} onChange={(v) => setChecks((c) => ({ ...c, terms: v }))} />
        <CheckRow label="Acepto la política de privacidad." checked={checks.privacy} onChange={(v) => setChecks((c) => ({ ...c, privacy: v }))} />
        <CheckRow label="Confirmo que la información proporcionada es verdadera." checked={checks.truthful} onChange={(v) => setChecks((c) => ({ ...c, truthful: v }))} />
      </div>
      {error && <div className="mt-3"><Alert>{error}</Alert></div>}
      <Button onClick={handleAccept} disabled={!allChecked || loading} className="mt-5 w-full">
        {loading ? "Guardando..." : "Continuar"}
      </Button>
    </Card>
  );
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm text-[var(--ink)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 rounded border-[var(--line)] text-[var(--brand)] focus:ring-[var(--brand)]"
      />
      {label}
    </label>
  );
}
