import { supabase } from "./supabase";

/**
 * Envía un mensaje al chat de Telegram configurado en el panel admin
 * (tabla bot_config). Si no hay token/chat configurado, o si Telegram
 * falla por cualquier razón, no interrumpe el flujo principal de la
 * app — solo se registra en consola.
 */
export async function notifyTelegram(text: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("bot_config")
      .select("telegram_bot_token, telegram_chat_id, enabled")
      .eq("id", true)
      .maybeSingle();

    if (error || !data) return;

    const { telegram_bot_token, telegram_chat_id, enabled } = data as {
      telegram_bot_token: string | null;
      telegram_chat_id: string | null;
      enabled: boolean;
    };

    if (!enabled || !telegram_bot_token || !telegram_chat_id) return;

    await fetch(`https://api.telegram.org/bot${telegram_bot_token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegram_chat_id,
        text,
        parse_mode: "HTML",
      }),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("No se pudo enviar la notificación de Telegram:", err);
  }
}
