import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Método no permitido');
  }

  // Verifica que la petición venga realmente de Telegram (secret_token
  // configurado al registrar el webhook con setWebhook).
  const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return res.status(401).send('No autorizado');
  }

  try {
    const update = req.body;
    const message = update?.message;

    // Solo nos interesan respuestas (reply) a un mensaje anterior: así sabemos
    // a qué conversación / usuario corresponde. Un mensaje "suelto" del admin
    // (sin responder a nada) no tiene forma de saber a quién va dirigido.
    const repliedToId = message?.reply_to_message?.message_id;
    const text = message?.text;

    if (!repliedToId || !text) {
      return res.status(200).json({ ok: true, skipped: true });
    }

    const { data: original, error: findError } = await supabaseAdmin
      .from('support_messages')
      .select('user_id')
      .eq('telegram_message_id', repliedToId)
      .maybeSingle();

    if (findError || !original) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'no_match' });
    }

    await supabaseAdmin.from('support_messages').insert([
      {
        user_id: original.user_id,
        sender: 'admin',
        body: text,
        is_read: false
      }
    ]);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Error en webhook de Telegram:', err);
    return res.status(500).json({ ok: false });
  }
}
