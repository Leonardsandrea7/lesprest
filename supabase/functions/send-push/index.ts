// LES PREST — Edge Function: send-push
// Envía una notificación push real a todos los usuarios suscritos.
// Solo puede ser llamada por un administrador (se verifica el rol
// usando el token del usuario que hace la petición).

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Limpia la llave por si al copiar/pegar en Supabase se coló un espacio,
// un salto de línea, o si por error se pegó "NOMBRE=valor" completo en
// vez de solo el valor.
function cleanKey(raw: string | undefined, envName: string): string {
  if (!raw) return "";
  let v = raw.trim();
  if (v.startsWith(envName + "=")) v = v.slice(envName.length + 1);
  v = v.replace(/\s+/g, "");
  v = v.replace(/=+$/, "");
  return v;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const VAPID_PUBLIC_KEY = cleanKey(Deno.env.get("VAPID_PUBLIC_KEY"), "VAPID_PUBLIC_KEY");
    const VAPID_PRIVATE_KEY = cleanKey(Deno.env.get("VAPID_PRIVATE_KEY"), "VAPID_PRIVATE_KEY");

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return new Response(
        JSON.stringify({
          error:
            "Faltan las llaves VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY en los secretos de esta función. Ve a Edge Functions -> send-push -> Secrets y agrégalas.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (VAPID_PUBLIC_KEY.length !== 87 || VAPID_PRIVATE_KEY.length !== 43) {
      return new Response(
        JSON.stringify({
          error: `Las llaves VAPID no tienen la longitud correcta (pública: ${VAPID_PUBLIC_KEY.length}, debe ser 87 · privada: ${VAPID_PRIVATE_KEY.length}, debe ser 43). Vuelve a copiarlas y guárdalas de nuevo, sin espacios extra.`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    webpush.setVapidDetails("mailto:admin@lesprest.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verificar que quien llama es admin, usando su propio token.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (!profile || (profile.role !== "admin" && profile.role !== "superadmin")) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { title, body, url, target_user_id } = await req.json();
    if (!title || !body) {
      return new Response(JSON.stringify({ error: "Falta título o mensaje" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cliente con permisos totales, solo para leer suscripciones y
    // limpiar las que ya no sirven.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Si viene target_user_id, se manda solo a esa persona (por ejemplo,
    // cuando se le aprueba su préstamo). Si no, se manda a todos (una
    // "novedad" general).
    let query = adminClient.from("push_subscriptions").select("*");
    if (target_user_id) query = query.eq("user_id", target_user_id);
    const { data: subs } = await query;

    const payload = JSON.stringify({ title, body, url: url || "/app" });
    let sent = 0;
    let removed = 0;

    await Promise.allSettled(
      (subs ?? []).map(async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload
          );
          sent++;
        } catch (err: any) {
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await adminClient.from("push_subscriptions").delete().eq("id", s.id);
            removed++;
          }
        }
      })
    );

    return new Response(JSON.stringify({ sent, removed, total: subs?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? "Error desconocido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
