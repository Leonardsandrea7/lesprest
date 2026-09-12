import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Card, Button, Textarea, Alert } from "../../components/ui";
import type { WhatsappMessage } from "../../lib/database.types";

export function AdminWhatsappMessages() {
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from("whatsapp_messages").select("*").order("label");
    setMessages((data as WhatsappMessage[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  function update(id: string, template: string) {
    setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, template } : m)));
  }

  async function save(msg: WhatsappMessage) {
    setSaving(msg.id);
    await supabase.from("whatsapp_messages").update({ template: msg.template }).eq("id", msg.id);
    setSaving(null);
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">Mensajes de WhatsApp</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Variables disponibles: [Nombre] [Monto] [Nivel] [Fecha] [ID]
      </p>

      <div className="mt-5 space-y-4">
        {messages.map((m) => (
          <Card key={m.id}>
            <p className="font-semibold text-[var(--ink)]">{m.label}</p>
            <Textarea rows={4} className="mt-2" value={m.template} onChange={(e) => update(m.id, e.target.value)} />
            <Button className="mt-2" disabled={saving === m.id} onClick={() => save(m)}>
              {saving === m.id ? "Guardando..." : "Guardar"}
            </Button>
          </Card>
        ))}
        {messages.length === 0 && <Alert kind="info">No hay mensajes configurados todavía.</Alert>}
      </div>
    </div>
  );
}
