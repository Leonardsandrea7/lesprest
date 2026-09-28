import { createClient } from '@supabase/supabase-js';

// Cliente con Service Role: se ejecuta SOLO en el servidor (Vercel Function),
// nunca en el navegador, así que puede leer la tabla app_secrets sin RLS.
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CHANNEL_KEYS = {
  ops: { token: 'telegram_ops_bot_token', chat: 'telegram_ops_chat_id' },
  kyc: { token: 'telegram_kyc_bot_token', chat: 'telegram_kyc_chat_id' },
  support: { token: 'telegram_support_bot_token', chat: 'telegram_support_chat_id' }
};

async function getSecret(key) {
  const { data } = await supabaseAdmin.from('app_secrets').select('value').eq('key', key).maybeSingle();
  return data?.value || '';
}

async function sendTelegramMessage(botToken, chatId, text, replyToMessageId) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_to_message_id: replyToMessageId || undefined
    })
  });
  return res.json();
}

async function sendTelegramPhoto(botToken, chatId, photoBase64, caption) {
  const arr = photoBase64.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = Buffer.from(arr[1] || arr[0], 'base64');
  const blob = new Blob([bstr], { type: mime });

  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('photo', blob, 'foto.jpg');
  formData.append('caption', caption || '');
  formData.append('parse_mode', 'HTML');

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
    method: 'POST',
    body: formData
  });
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { channel, text, photoBase64, photoCaption, replyToMessageId } = req.body || {};

    if (!channel || !CHANNEL_KEYS[channel]) {
      return res.status(400).json({ error: 'Canal inválido. Usa ops, kyc o support.' });
    }

    const { token: tokenKey, chat: chatKey } = CHANNEL_KEYS[channel];
    const botToken = await getSecret(tokenKey);
    const chatId = await getSecret(chatKey);

    if (!botToken || !chatId) {
      // No es un error fatal: si el admin todavía no configuró ese bot,
      // simplemente no se envía nada (la operación en la app sigue funcionando).
      return res.status(200).json({ ok: false, reason: 'bot_no_configurado' });
    }

    let result = null;

    if (photoBase64) {
      result = await sendTelegramPhoto(botToken, chatId, photoBase64, photoCaption || '');
    } else if (text) {
      result = await sendTelegramMessage(botToken, chatId, text, replyToMessageId);
    } else {
      return res.status(400).json({ error: 'Falta "text" o "photoBase64".' });
    }

    const messageId = result?.result?.message_id || null;
    return res.status(200).json({ ok: !!result?.ok, message_id: messageId });
  } catch (err) {
    console.error('Error en /api/notify:', err);
    return res.status(500).json({ error: 'Error interno enviando notificación.' });
  }
}
