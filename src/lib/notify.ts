/**
 * En vez de llamar a la API de Telegram directo desde el navegador (lo cual
 * expondría el bot token a cualquiera que abra las DevTools), todo pasa por
 * /api/notify, una función serverless que guarda los tokens de forma privada.
 */

export type NotifyChannel = 'ops' | 'kyc' | 'support';

interface NotifyResult {
  ok: boolean;
  message_id?: number | null;
}

export const notify = async (params: {
  channel: NotifyChannel;
  text?: string;
  photoBase64?: string;
  photoCaption?: string;
  replyToMessageId?: number;
}): Promise<NotifyResult> => {
  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return await res.json();
  } catch (err) {
    console.warn('No se pudo enviar la notificación a Telegram:', err);
    return { ok: false };
  }
};
