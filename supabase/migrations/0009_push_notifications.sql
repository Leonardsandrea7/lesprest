-- =====================================================================
-- LES PREST — Notificaciones push reales (Web Push)
-- =====================================================================

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy "usuario gestiona su propia suscripcion" on push_subscriptions
  for all using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());
