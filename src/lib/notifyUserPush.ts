import { supabase } from "./supabase";

export async function notifyUserPush(userId: string, title: string, body: string): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;

    await fetch("https://hxthtzytyaytcevpveqo.supabase.co/functions/v1/send-push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title, body, target_user_id: userId }),
    });
  } catch {
    // Silencioso: si falla el push, no debe interrumpir la acción del admin.
  }
}
