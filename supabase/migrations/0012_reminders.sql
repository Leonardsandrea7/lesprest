-- =====================================================================
-- LES PREST — Recordatorios automáticos de pago
-- =====================================================================

create table reminder_log (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans(id) on delete cascade,
  installment_id uuid references loan_installments(id) on delete cascade,
  reminder_type text not null, -- '3_dias', '1_dia', 'hoy'
  sent_at timestamptz not null default now(),
  unique (loan_id, installment_id, reminder_type)
);

alter table reminder_log enable row level security;
create policy "admin ve recordatorios enviados" on reminder_log for select using (is_admin());

-- ---------------------------------------------------------------------
-- Programar la revisión diaria (requiere las extensiones pg_cron y
-- pg_net, disponibles en Supabase). Se ejecuta todos los días a las
-- 9:00 AM (hora UTC) y llama a la Edge Function `send-reminders`.
-- ---------------------------------------------------------------------
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'les-prest-recordatorios-diarios',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://hxthtzytyaytcevpveqo.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer 27b9982d521331b51a057ca81347e20a552035970ab16014'
    ),
    body := '{}'::jsonb
  );
  $$
);
