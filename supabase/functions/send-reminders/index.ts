// PrestApp — Edge Function: send-reminders
// Revisa qué cuotas (o préstamos sin cuotas) vencen en 3 días, en 1 día,
// o hoy, y le manda un push al usuario correspondiente. Pensada para
// correr sola todos los días mediante pg_cron (ver migración 0012).
// También se puede llamar manualmente como admin, para probar.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const CRON_SECRET = Deno.env.get("CRON_SECRET");
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Autorización: o viene del cron con el secreto compartido, o de un
    // admin autenticado probando manualmente.
    let authorized = CRON_SECRET && token === CRON_SECRET;
    if (!authorized) {
      const callerClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userData } = await callerClient.auth.getUser();
      if (userData?.user) {
        const { data: profile } = await callerClient.from("profiles").select("role").eq("id", userData.user.id).single();
        authorized = profile?.role === "admin" || profile?.role === "superadmin";
      }
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const VAPID_PUBLIC_KEY = cleanKey(Deno.env.get("VAPID_PUBLIC_KEY"), "VAPID_PUBLIC_KEY");
    const VAPID_PRIVATE_KEY = cleanKey(Deno.env.get("VAPID_PRIVATE_KEY"), "VAPID_PRIVATE_KEY");
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return new Response(JSON.stringify({ error: "Faltan las llaves VAPID en los secretos." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    webpush.setVapidDetails("mailto:admin@prestapp.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const windows: { type: string; days: number; text: string }[] = [
      { type: "3_dias", days: 3, text: "vence en 3 días" },
      { type: "1_dia", days: 1, text: "vence mañana" },
      { type: "hoy", days: 0, text: "vence hoy" },
    ];

    let sent = 0;
    const details: any[] = [];

    for (const w of windows) {
      const targetDate = new Date();
      targetDate.setUTCDate(targetDate.getUTCDate() + w.days);
      const dayStr = targetDate.toISOString().slice(0, 10);

      // Cuotas (préstamos con más de 1 cuota) que vencen ese día y siguen pendientes.
      const { data: installments } = await adminClient
        .from("loan_installments")
        .select("id, loan_id, amount, due_at, loans(user_id, public_id, installments_count)")
        .eq("status", "pendiente")
        .gte("due_at", `${dayStr}T00:00:00Z`)
        .lt("due_at", `${dayStr}T23:59:59Z`);

      for (const inst of installments ?? []) {
        const loanInfo = (inst as any).loans;
        if (!loanInfo) continue;
        const already = await adminClient
          .from("reminder_log")
          .select("id")
          .eq("loan_id", inst.loan_id)
          .eq("installment_id", inst.id)
          .eq("reminder_type", w.type)
          .maybeSingle();
        if (already.data) continue;

        const count = await sendToUser(
          adminClient,
          loanInfo.user_id,
          "Recordatorio de pago — PrestApp",
          `Tu cuota de ${loanInfo.public_id} ${w.text}.`
        );
        if (count > 0) {
          await adminClient
            .from("reminder_log")
            .insert({ loan_id: inst.loan_id, installment_id: inst.id, reminder_type: w.type });
          sent += count;
          details.push({ loan: loanInfo.public_id, type: w.type });
        }
      }

      // Préstamos de una sola cuota (installments_count = 1) que vencen ese día.
      const { data: loans } = await adminClient
        .from("loans")
        .select("id, user_id, public_id, due_at")
        .eq("status", "activo")
        .eq("installments_count", 1)
        .gte("due_at", `${dayStr}T00:00:00Z`)
        .lt("due_at", `${dayStr}T23:59:59Z`);

      for (const loan of loans ?? []) {
        const already = await adminClient
          .from("reminder_log")
          .select("id")
          .eq("loan_id", loan.id)
          .is("installment_id", null)
          .eq("reminder_type", w.type)
          .maybeSingle();
        if (already.data) continue;

        const count = await sendToUser(
          adminClient,
          loan.user_id,
          "Recordatorio de pago — PrestApp",
          `Tu préstamo ${loan.public_id} ${w.text}.`
        );
        if (count > 0) {
          await adminClient.from("reminder_log").insert({ loan_id: loan.id, installment_id: null, reminder_type: w.type });
          sent += count;
          details.push({ loan: loan.public_id, type: w.type });
        }
      }
    }

    return new Response(JSON.stringify({ sent, details }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? "Error desconocido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sendToUser(adminClient: any, userId: string, title: string, body: string): Promise<number> {
  const { data: subs } = await adminClient.from("push_subscriptions").select("*").eq("user_id", userId);
  if (!subs || subs.length === 0) return 0;

  const payload = JSON.stringify({ title, body, url: "/app" });
  let count = 0;
  await Promise.allSettled(
    subs.map(async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        count++;
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await adminClient.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    })
  );
  return count;
}
