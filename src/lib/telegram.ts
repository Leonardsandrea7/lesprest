/**
 * Servicio de Notificaciones a Telegram
 * - Envía registros KYC con fotos al canal de registro
 * - Envía notificaciones de préstamos y pagos al canal de operaciones
 */

export const sendTelegramMessage = async (
  botToken: string,
  chatId: string,
  text: string
): Promise<boolean> => {
  if (!botToken || !chatId) return false;
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML'
      })
    });
    return res.ok;
  } catch (err) {
    console.warn('Error enviando mensaje a Telegram:', err);
    return false;
  }
};

export const sendTelegramPhoto = async (
  botToken: string,
  chatId: string,
  photoBase64: string,
  caption: string
): Promise<boolean> => {
  if (!botToken || !chatId || !photoBase64) return false;
  try {
    // Convert base64 DataURL to Blob
    const arr = photoBase64.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1] || arr[0]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const blob = new Blob([u8arr], { type: mime });

    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('photo', blob, 'foto.jpg');
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');

    const url = `https://api.telegram.org/bot${botToken}/sendPhoto`;
    const res = await fetch(url, {
      method: 'POST',
      body: formData
    });
    return res.ok;
  } catch (err) {
    console.warn('Error enviando foto a Telegram:', err);
    return false;
  }
};
