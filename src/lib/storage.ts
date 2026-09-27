import { supabase } from './supabase';

/**
 * Sube una foto (dataURL base64, tal como la entrega la cámara o el input file)
 * al bucket privado "kyc-photos" de Supabase Storage, dentro de una carpeta
 * con el id del usuario, y devuelve la URL pública (o firmada) para guardarla
 * en profiles.cedula_url / profiles.selfie_url.
 */
export const uploadKycPhoto = async (
  userId: string,
  kind: 'cedula' | 'selfie',
  dataUrl: string
): Promise<string | null> => {
  try {
    const mimeMatch = dataUrl.match(/^data:(.*?);base64,/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const ext = mime.split('/')[1] || 'jpg';
    const base64 = dataUrl.split(',')[1] || '';

    const bstr = atob(base64);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const blob = new Blob([u8arr], { type: mime });

    const path = `${userId}/${kind}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('kyc-photos')
      .upload(path, blob, { contentType: mime, upsert: true });

    if (uploadError) {
      console.error('Error subiendo foto a Storage:', uploadError);
      return null;
    }

    // El bucket es privado: guardamos una URL firmada de larga duración (1 año)
    // para que el admin pueda revisarla desde el panel sin exponer el bucket públicamente.
    const { data: signedData, error: signedError } = await supabase.storage
      .from('kyc-photos')
      .createSignedUrl(path, 60 * 60 * 24 * 365);

    if (signedError || !signedData) {
      console.error('Error generando URL firmada:', signedError);
      return null;
    }

    return signedData.signedUrl;
  } catch (err) {
    console.error('Error procesando la foto para Storage:', err);
    return null;
  }
};
