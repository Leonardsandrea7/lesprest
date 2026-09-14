import { useState } from "react";
import { supabase } from "./supabase";

// Clave pública VAPID — es seguro que esté en el código, está diseñada
// para ser pública (la privada nunca sale de Supabase).
const VAPID_PUBLIC_KEY = "BDlFUgDjjECoNokqsu_Zrfk3yfFRTm8HBU-Dppqt5Y7BGSwHyCTROx-Zc6RwBlW1XoFaX1WbUgvlwQ_0oG0Ind0";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function usePushSubscription() {
  const [status, setStatus] = useState<"idle" | "requesting" | "activo" | "error" | "no_soportado">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function activate(userId: string) {
    setStatus("requesting");
    setMessage(null);

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("no_soportado");
      setMessage("Tu navegador no soporta notificaciones push.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("error");
        setMessage("No diste permiso para las notificaciones.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        });
      }

      const json = subscription.toJSON();
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: userId,
          endpoint: json.endpoint!,
          p256dh: json.keys!.p256dh,
          auth: json.keys!.auth,
        },
        { onConflict: "endpoint" }
      );
      if (error) throw error;

      setStatus("activo");
      setMessage("Notificaciones activadas.");
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message ?? "No se pudo activar las notificaciones.");
    }
  }

  return { status, message, activate };
}
