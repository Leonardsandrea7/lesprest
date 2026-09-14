import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Card, Button, Field, Input, Alert } from "../../components/ui";

export function AdminSettings() {
  const [rate, setRate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [botEnabled, setBotEnabled] = useState(true);
  const [savingBot, setSavingBot] = useState(false);
  const [botMessage, setBotMessage] = useState<string | null>(null);

  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [sendingPush, setSendingPush] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: rateData }, { data: botData }] = await Promise.all([
      supabase.from("settings").select("value").eq("key", "usd_to_ves_rate").maybeSingle(),
      supabase.from("bot_config").select("*").eq("id", true).maybeSingle(),
    ]);
    const value = (rateData as { value: number } | null)?.value;
    setRate(typeof value === "number" ? String(value) : "");

    const bot = botData as { telegram_bot_token: string | null; telegram_chat_id: string | null; enabled: boolean } | null;
    setBotToken(bot?.telegram_bot_token ?? "");
    setChatId(bot?.telegram_chat_id ?? "");
    setBotEnabled(bot?.enabled ?? true);

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    const numeric = Number(rate);
    if (!numeric || numeric <= 0) {
      setMessage("Ingresa una tasa válida, mayor a 0.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from("settings")
      .update({ value: numeric, updated_at: new Date().toISOString() })
      .eq("key", "usd_to_ves_rate");
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Tasa actualizada. Ya se refleja en toda la plataforma.");
  }

  async function saveBot() {
    setSavingBot(true);
    setBotMessage(null);
    const { error } = await supabase
      .from("bot_config")
      .update({
        telegram_bot_token: botToken.trim() || null,
        telegram_chat_id: chatId.trim() || null,
        enabled: botEnabled,
      })
      .eq("id", true);
    setSavingBot(false);
    if (error) {
      setBotMessage(error.message);
      return;
    }
    setBotMessage("Configuración de Telegram guardada.");
  }

  async function sendTestMessage() {
    setBotMessage(null);
    if (!botToken || !chatId) {
      setBotMessage("Completa el token y el chat ID primero, y guarda antes de probar.");
      return;
    }
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: "✅ LES PREST: esta es una notificación de prueba." }),
      });
      const json = await res.json();
      if (!json.ok) {
        setBotMessage(`Telegram respondió con un error: ${json.description ?? "desconocido"}`);
        return;
      }
      setBotMessage("Mensaje de prueba enviado. Revisa tu Telegram.");
    } catch {
      setBotMessage("No se pudo conectar con Telegram. Revisa el token.");
    }
  }

  async function sendPushNotification() {
    if (!pushTitle.trim() || !pushBody.trim()) {
      setPushMessage("Escribe un título y un mensaje.");
      return;
    }
    setSendingPush(true);
    setPushMessage(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("No hay sesión activa.");

      const res = await fetch("https://hxthtzytyaytcevpveqo.supabase.co/functions/v1/send-push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: pushTitle, body: pushBody }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al enviar la notificación.");

      setPushMessage(`Enviada a ${json.sent} de ${json.total} dispositivos suscritos.`);
      setPushTitle("");
      setPushBody("");
    } catch (err: any) {
      setPushMessage(err?.message ?? "Ocurrió un error al enviar la notificación.");
    } finally {
      setSendingPush(false);
    }
  }

  if (loading) return <p className="text-sm text-[var(--muted)]">Cargando...</p>;

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">Configuración general</h1>

      <Card>
        <p className="font-semibold text-[var(--ink)]">Tasa de cambio (USD → Bs)</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Todos los montos internos se calculan en dólares. Esta tasa se usa solo para mostrar el
          equivalente en bolívares a los usuarios y en el panel admin. Actualízala cuando cambie el precio del dólar.
        </p>
        <div className="mt-4 max-w-xs">
          <Field label="1 USD equivale a (Bs.)">
            <Input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Ej: 180.50" />
          </Field>
        </div>
        {message && <div className="mt-4"><Alert kind="info">{message}</Alert></div>}
        <Button className="mt-4" disabled={saving} onClick={save}>
          {saving ? "Guardando..." : "Guardar tasa"}
        </Button>
      </Card>

      <Card>
        <p className="font-semibold text-[var(--ink)]">Bot de avisos (Telegram)</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Recibe un mensaje en Telegram cada vez que alguien solicita un préstamo o registra un pago.
        </p>
        <div className="mt-4 space-y-4">
          <Field label="Token del bot" hint="El que te dio @BotFather">
            <Input value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder="7123456789:AAHk3j..." />
          </Field>
          <Field label="Chat ID" hint="El identificador numérico de tu chat">
            <Input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="123456789" />
          </Field>
          <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
            <input type="checkbox" checked={botEnabled} onChange={(e) => setBotEnabled(e.target.checked)} />
            Avisos activados
          </label>
        </div>
        {botMessage && <div className="mt-4"><Alert kind="info">{botMessage}</Alert></div>}
        <div className="mt-4 flex gap-2">
          <Button disabled={savingBot} onClick={saveBot}>
            {savingBot ? "Guardando..." : "Guardar"}
          </Button>
          <Button variant="secondary" onClick={sendTestMessage}>
            Enviar mensaje de prueba
          </Button>
        </div>
      </Card>

      <Card>
        <p className="font-semibold text-[var(--ink)]">Enviar novedad (notificación push)</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Le llega directo al celular de todos los usuarios que hayan activado las notificaciones,
          aunque no tengan la app abierta.
        </p>
        <div className="mt-4 space-y-4">
          <Field label="Título">
            <Input value={pushTitle} onChange={(e) => setPushTitle(e.target.value)} placeholder="Ej: ¡Nueva promoción!" />
          </Field>
          <Field label="Mensaje">
            <Input value={pushBody} onChange={(e) => setPushBody(e.target.value)} placeholder="Ej: Este mes tu segundo préstamo tiene mejor tasa." />
          </Field>
        </div>
        {pushMessage && <div className="mt-4"><Alert kind="info">{pushMessage}</Alert></div>}
        <Button className="mt-4" disabled={sendingPush} onClick={sendPushNotification}>
          {sendingPush ? "Enviando..." : "Enviar a todos"}
        </Button>
      </Card>
    </div>
  );
}
