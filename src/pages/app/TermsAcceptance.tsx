import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { Button, Card, Alert } from "../../components/ui";

export function TermsAcceptance({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const [checks, setChecks] = useState({ terms: false, privacy: false, truthful: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <div className="mt-4 space-y-3">
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
