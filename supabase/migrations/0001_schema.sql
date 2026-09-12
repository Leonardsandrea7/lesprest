-- =====================================================================
-- LES PREST — Esquema de base de datos (Supabase / PostgreSQL)
-- =====================================================================
-- Filosofía de seguridad:
--   - Ningún valor de negocio (nivel, monto, tasa, estado, vencimiento)
--     se escribe desde el cliente. Todo cambio de estado pasa por
--     funciones SECURITY DEFINER que solo el rol 'admin' puede ejecutar
--     (ver 0002_functions.sql).
--   - RLS activo en todas las tablas. Los usuarios solo leen sus propios
--     datos; los admins leen/escriben según policies explícitas.
--   - La tasa de retorno, el plazo y las reglas de nivel viven en
--     `loan_levels` y `settings`, nunca hardcodeadas.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- ROLES DE APLICACIÓN
-- ---------------------------------------------------------------------
create type app_role as enum ('user', 'admin', 'superadmin');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role app_role not null default 'user',
  full_name text,
  current_level_id uuid, -- fk agregada tras crear loan_levels
  loans_completed_current_level int not null default 0,
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- KYC
-- ---------------------------------------------------------------------
create type kyc_status as enum (
  'pendiente', 'en_revision', 'aprobado', 'rechazado', 'requiere_informacion'
);

create table kyc (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  full_name text not null,
  document_id text not null,
  birth_date date not null,
  state text not null,
  city text not null,
  address text not null,
  whatsapp_number text not null,
  extra_info text,
  document_files jsonb default '[]'::jsonb, -- rutas en Supabase Storage
  status kyc_status not null default 'pendiente',
  reviewer_id uuid references profiles(id),
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_kyc_user on kyc(user_id);
create index idx_kyc_status on kyc(status);

-- Solo puede haber un KYC "activo" por usuario a la vez (el más reciente manda)
create unique index idx_kyc_one_active_per_user
  on kyc(user_id) where status in ('pendiente', 'en_revision', 'requiere_informacion');

-- ---------------------------------------------------------------------
-- MÉTODOS DE PAGO DEL USUARIO (Pago Móvil - destino de desembolso)
-- ---------------------------------------------------------------------
create table user_payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  bank text not null,
  holder_name text not null,
  document_id text not null,
  phone text not null,
  is_locked boolean not null default false, -- true si hay préstamo pendiente de desembolso
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_upm_user on user_payment_methods(user_id);

-- ---------------------------------------------------------------------
-- NIVELES DE PRÉSTAMO (100% configurable desde admin)
-- ---------------------------------------------------------------------
create table loan_levels (
  id uuid primary key default gen_random_uuid(),
  level_number int not null unique,
  principal_amount numeric(12,2) not null check (principal_amount > 0),
  return_rate_percent numeric(6,3) not null check (return_rate_percent >= 0),
  term_days int not null check (term_days > 0),
  loans_required_to_unlock_next int not null default 2 check (loans_required_to_unlock_next > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_levels_number on loan_levels(level_number);

alter table profiles
  add constraint fk_profiles_level foreign key (current_level_id) references loan_levels(id);

-- ---------------------------------------------------------------------
-- PRÉSTAMOS
-- ---------------------------------------------------------------------
create type loan_status as enum (
  'solicitado', 'en_revision', 'aprobado', 'pendiente_desembolso',
  'activo', 'pendiente_pago', 'pagado', 'vencido', 'rechazado'
);

create sequence loan_public_id_seq start 1;

create table loans (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default ('LES-' || lpad(nextval('loan_public_id_seq')::text, 6, '0')),
  user_id uuid not null references profiles(id) on delete cascade,
  level_id uuid not null references loan_levels(id),
  level_number int not null,          -- snapshot al momento de solicitar
  principal_amount numeric(12,2) not null,   -- snapshot
  return_rate_percent numeric(6,3) not null, -- snapshot
  return_amount numeric(12,2) not null,      -- snapshot calculado
  total_amount numeric(12,2) not null,       -- snapshot calculado
  term_days int not null,                    -- snapshot
  status loan_status not null default 'solicitado',
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references profiles(id),
  rejected_reason text,
  disbursed_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  amount_paid numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_loans_user on loans(user_id);
create index idx_loans_status on loans(status);

-- Un usuario no puede tener más de un préstamo "vivo" simultáneamente
create unique index idx_loans_one_open_per_user
  on loans(user_id) where status in (
    'solicitado','en_revision','aprobado','pendiente_desembolso','activo','pendiente_pago'
  );

-- ---------------------------------------------------------------------
-- DESEMBOLSOS (registro manual del admin)
-- ---------------------------------------------------------------------
create table loan_disbursements (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans(id) on delete cascade,
  admin_id uuid not null references profiles(id),
  amount_sent numeric(12,2) not null,
  bank_used text not null,
  reference_number text not null,
  disbursed_date date not null,
  disbursed_time time not null,
  notes text,
  created_at timestamptz not null default now()
);
create index idx_disb_loan on loan_disbursements(loan_id);

-- ---------------------------------------------------------------------
-- MÉTODOS DE PAGO DE LA PLATAFORMA (a dónde paga el usuario)
-- ---------------------------------------------------------------------
create table platform_payment_methods (
  id uuid primary key default gen_random_uuid(),
  bank text not null,
  phone text not null,
  document_id text not null,
  holder_name text not null,
  instructions text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PAGOS DEL USUARIO (cuotas)
-- ---------------------------------------------------------------------
create type payment_status as enum ('pendiente_verificacion', 'confirmado', 'rechazado');

create table loan_payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans(id) on delete cascade,
  user_id uuid not null references profiles(id),
  bank text not null,
  amount numeric(12,2) not null,
  reference_number text not null,
  payment_date date not null,
  receipt_url text,
  status payment_status not null default 'pendiente_verificacion',
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_payments_loan on loan_payments(loan_id);
create index idx_payments_user on loan_payments(user_id);

-- CRÍTICO (sección 16 del spec): referencia bancaria única en todo el
-- sistema, sin importar usuario ni préstamo. Se excluyen las rechazadas
-- para permitir reintentar con la referencia correcta tras un rechazo
-- por error de captura, pero nunca dos operaciones "vivas" con la misma
-- referencia.
create unique index idx_payments_unique_reference
  on loan_payments(reference_number)
  where status in ('pendiente_verificacion', 'confirmado');

-- ---------------------------------------------------------------------
-- TÉRMINOS Y CONDICIONES
-- ---------------------------------------------------------------------
create table legal_documents (
  id uuid primary key default gen_random_uuid(),
  doc_type text not null, -- 'terminos', 'privacidad', 'contrato_prestamo'
  version text not null,
  title text not null,
  content text not null,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

create table terms_acceptance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  document_id uuid not null references legal_documents(id),
  accepted_at timestamptz not null default now(),
  ip_address text
);
create index idx_terms_user on terms_acceptance(user_id);

-- ---------------------------------------------------------------------
-- MENSAJES DE WHATSAPP (editables desde admin)
-- ---------------------------------------------------------------------
create table whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  key text not null unique, -- 'kyc_aprobado', 'kyc_rechazado', etc.
  label text not null,
  template text not null,   -- soporta [Nombre] [Monto] [Nivel] [Fecha] [ID]
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- NOTIFICACIONES IN-APP
-- ---------------------------------------------------------------------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_notifications_user on notifications(user_id, is_read);

-- ---------------------------------------------------------------------
-- AUDITORÍA
-- ---------------------------------------------------------------------
create table admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references profiles(id),
  action text not null,          -- 'aprobar_kyc', 'aprobar_prestamo', etc.
  target_table text not null,
  target_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);
create index idx_admin_actions_admin on admin_actions(admin_id);
create index idx_admin_actions_target on admin_actions(target_table, target_id);

-- ---------------------------------------------------------------------
-- CONFIGURACIÓN GLOBAL (clave/valor, para settings que no son por nivel)
-- ---------------------------------------------------------------------
create table settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('admin', 'superadmin')
  );
$$;

alter table profiles enable row level security;
alter table kyc enable row level security;
alter table user_payment_methods enable row level security;
alter table loan_levels enable row level security;
alter table loans enable row level security;
alter table loan_disbursements enable row level security;
alter table platform_payment_methods enable row level security;
alter table loan_payments enable row level security;
alter table legal_documents enable row level security;
alter table terms_acceptance enable row level security;
alter table whatsapp_messages enable row level security;
alter table notifications enable row level security;
alter table admin_actions enable row level security;
alter table settings enable row level security;

-- profiles
create policy "usuario ve su perfil" on profiles for select using (id = auth.uid() or is_admin());
create policy "usuario actualiza solo su nombre" on profiles for update using (id = auth.uid())
  with check (id = auth.uid());
create policy "admin gestiona perfiles" on profiles for all using (is_admin());

-- kyc
create policy "usuario ve su kyc" on kyc for select using (user_id = auth.uid() or is_admin());
create policy "usuario crea su kyc" on kyc for insert with check (user_id = auth.uid());
create policy "admin actualiza kyc" on kyc for update using (is_admin());

-- user_payment_methods
create policy "usuario ve sus metodos de pago" on user_payment_methods for select
  using (user_id = auth.uid() or is_admin());
create policy "usuario crea sus metodos de pago" on user_payment_methods for insert
  with check (user_id = auth.uid());
create policy "usuario actualiza si no esta bloqueado" on user_payment_methods for update
  using (user_id = auth.uid() and is_locked = false or is_admin());

-- loan_levels: lectura pública para usuarios autenticados, escritura solo admin
create policy "lectura de niveles" on loan_levels for select using (auth.role() = 'authenticated');
create policy "admin gestiona niveles" on loan_levels for all using (is_admin());

-- loans: el usuario NUNCA puede insertar/actualizar directamente estados o montos.
-- Toda escritura pasa por funciones SECURITY DEFINER (ver 0002_functions.sql).
create policy "usuario ve sus prestamos" on loans for select using (user_id = auth.uid() or is_admin());
create policy "admin gestiona prestamos" on loans for all using (is_admin());

-- loan_disbursements: solo admin
create policy "usuario ve desembolsos de sus prestamos" on loan_disbursements for select
  using (is_admin() or exists (select 1 from loans l where l.id = loan_id and l.user_id = auth.uid()));
create policy "admin gestiona desembolsos" on loan_disbursements for all using (is_admin());

-- platform_payment_methods: lectura pública (activos), escritura admin
create policy "lectura metodos de pago plataforma" on platform_payment_methods for select
  using (auth.role() = 'authenticated');
create policy "admin gestiona metodos de pago plataforma" on platform_payment_methods for all using (is_admin());

-- loan_payments: el usuario inserta su pago, pero NUNCA cambia el estado
create policy "usuario ve sus pagos" on loan_payments for select using (user_id = auth.uid() or is_admin());
create policy "usuario registra su pago" on loan_payments for insert with check (user_id = auth.uid());
create policy "admin actualiza pagos" on loan_payments for update using (is_admin());

-- legal_documents: lectura pública, escritura admin
create policy "lectura documentos legales" on legal_documents for select using (true);
create policy "admin gestiona documentos legales" on legal_documents for all using (is_admin());

-- terms_acceptance
create policy "usuario ve sus aceptaciones" on terms_acceptance for select
  using (user_id = auth.uid() or is_admin());
create policy "usuario acepta terminos" on terms_acceptance for insert with check (user_id = auth.uid());

-- whatsapp_messages: solo admin (contiene lógica interna de operación)
create policy "admin gestiona mensajes whatsapp" on whatsapp_messages for all using (is_admin());

-- notifications
create policy "usuario ve sus notificaciones" on notifications for select
  using (user_id = auth.uid() or is_admin());
create policy "usuario marca como leida" on notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admin crea notificaciones" on notifications for insert with check (is_admin());

-- admin_actions: solo lectura/escritura de admins
create policy "admin ve auditoria" on admin_actions for select using (is_admin());
create policy "admin escribe auditoria" on admin_actions for insert with check (is_admin());

-- settings
create policy "lectura de settings publicos" on settings for select using (auth.role() = 'authenticated');
create policy "admin gestiona settings" on settings for all using (is_admin());

-- =====================================================================
-- TRIGGER: crear perfil automáticamente al registrarse
-- =====================================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, role, current_level_id, loans_completed_current_level)
  values (
    new.id,
    'user',
    (select id from loan_levels where level_number = 1 and is_active = true limit 1),
    0
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =====================================================================
-- SEED: niveles iniciales (editable después desde el admin)
-- Tasa de ejemplo NO usuraria: 6% a 10 días, ajustable en producción
-- desde ADMIN → NIVELES. Ningún valor está hardcodeado en la app.
-- =====================================================================
insert into loan_levels (level_number, principal_amount, return_rate_percent, term_days, loans_required_to_unlock_next) values
  (1, 1,  6, 10, 2),
  (2, 5,  6, 10, 2),
  (3, 10, 6, 10, 2),
  (4, 20, 6, 10, 2),
  (5, 40, 6, 10, 2),
  (6, 80, 6, 10, 2);

insert into whatsapp_messages (key, label, template) values
  ('kyc_aprobado', 'KYC aprobado', 'Hola [Nombre]. Somos LES PREST. Tu KYC ha sido aprobado. Ya puedes solicitar tu préstamo desde la plataforma. Recuerda que debes cumplir las condiciones y fecha de pago indicadas en tu préstamo. Gracias por confiar en LES PREST.'),
  ('kyc_rechazado', 'KYC rechazado', 'Hola [Nombre]. Somos LES PREST. Hemos revisado tu solicitud de KYC y en esta oportunidad no ha sido aprobada. Puedes revisar la información proporcionada y comunicarte con nosotros si necesitas aclarar algún dato.'),
  ('kyc_info_adicional', 'Información adicional', 'Hola [Nombre]. Somos LES PREST. Necesitamos información adicional para completar la verificación de tu perfil. Por favor revisa tu cuenta para conocer los datos que necesitamos.'),
  ('pago_confirmado', 'Pago confirmado', 'Hola [Nombre]. Tu pago ha sido verificado y registrado correctamente en LES PREST. Gracias por cumplir con tu compromiso.'),
  ('prestamo_aprobado', 'Préstamo aprobado', 'Hola [Nombre]. Tu préstamo ha sido aprobado. Revisa tu cuenta LES PREST para consultar los detalles.'),
  ('prestamo_pagado', 'Préstamo pagado', 'Hola [Nombre]. Tu préstamo #[ID] ha sido marcado como pagado en su totalidad. ¡Gracias por confiar en LES PREST!'),
  ('nivel_desbloqueado', 'Nuevo nivel desbloqueado', 'Hola [Nombre]. ¡Felicitaciones! Has desbloqueado el Nivel [Nivel] en LES PREST. Ya puedes solicitar hasta [Monto].');

insert into settings (key, value) values
  ('kyc_required_fields', '["full_name","document_id","birth_date","state","city","address","whatsapp_number"]'),
  ('app_name', '"LES PREST"'),
  ('app_slogan', '"Tu préstamo seguro"');
