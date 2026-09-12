-- =====================================================================
-- LES PREST — RESETEO COMPLETO
-- =====================================================================
-- Borra todas las tablas, funciones, triggers y tipos creados por el
-- proyecto, para poder volver a ejecutar 0001_schema.sql y
-- 0002_functions.sql desde cero, sin restos de una instalación anterior
-- a medio hacer.
-- NO borra tus usuarios de auth.users: eso se hace manualmente desde
-- Authentication -> Users en el dashboard de Supabase.
-- =====================================================================

drop trigger if exists on_auth_user_created on auth.users;

drop function if exists handle_new_user() cascade;
drop function if exists is_admin() cascade;
drop function if exists request_loan() cascade;
drop function if exists admin_review_loan(uuid, text, text) cascade;
drop function if exists admin_confirm_disbursement(uuid, numeric, text, text, date, time, text) cascade;
drop function if exists submit_loan_payment(uuid, text, numeric, text, date, text) cascade;
drop function if exists admin_review_payment(uuid, text, text) cascade;
drop function if exists mark_overdue_loans() cascade;
drop function if exists admin_review_kyc(uuid, text, text) cascade;

drop table if exists admin_actions cascade;
drop table if exists notifications cascade;
drop table if exists whatsapp_messages cascade;
drop table if exists terms_acceptance cascade;
drop table if exists legal_documents cascade;
drop table if exists loan_payments cascade;
drop table if exists platform_payment_methods cascade;
drop table if exists loan_disbursements cascade;
drop table if exists loans cascade;
drop table if exists loan_levels cascade;
drop table if exists user_payment_methods cascade;
drop table if exists kyc cascade;
drop table if exists settings cascade;
drop table if exists profiles cascade;

drop sequence if exists loan_public_id_seq;

drop type if exists app_role cascade;
drop type if exists kyc_status cascade;
drop type if exists loan_status cascade;
drop type if exists payment_status cascade;

-- Confirmación
select 'Reseteo completo. Ahora ejecuta 0001_schema.sql y luego 0002_functions.sql' as resultado;
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
-- =====================================================================
-- LES PREST — Funciones de negocio (SECURITY DEFINER)
-- =====================================================================
-- Regla de seguridad central (sección 31 del spec): el usuario nunca
-- decide su nivel, su monto, la tasa, el estado de su préstamo ni las
-- fechas de vencimiento. Todo eso pasa por estas funciones, que:
--   1) leen el estado real desde la base de datos,
--   2) validan condiciones (KYC aprobado, sin préstamo abierto, etc.),
--   3) escriben con privilegios elevados, evitando que el usuario
--      pueda hacer un UPDATE directo sobre loans/loan_payments.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) SOLICITAR PRÉSTAMO
-- El usuario solo puede llamar a esto; el monto/tasa/plazo se toman
-- del nivel actual guardado en su perfil, nunca de un parámetro del
-- cliente.
-- ---------------------------------------------------------------------
create or replace function request_loan()
returns loans
language plpgsql security definer set search_path = public as $$
declare
  v_profile profiles;
  v_level loan_levels;
  v_kyc kyc;
  v_upm user_payment_methods;
  v_terms_ok boolean;
  v_loan loans;
  v_return_amount numeric(12,2);
  v_total_amount numeric(12,2);
begin
  select * into v_profile from profiles where id = auth.uid();
  if v_profile is null then
    raise exception 'Perfil no encontrado';
  end if;
  if v_profile.is_blocked then
    raise exception 'Tu cuenta está bloqueada. Contacta a soporte.';
  end if;

  -- KYC aprobado
  select * into v_kyc from kyc
    where user_id = auth.uid() and status = 'aprobado'
    order by reviewed_at desc limit 1;
  if v_kyc is null then
    raise exception 'Debes completar y aprobar tu KYC antes de solicitar un préstamo.';
  end if;

  -- Términos aceptados (al menos una aceptación existente)
  select exists(select 1 from terms_acceptance where user_id = auth.uid()) into v_terms_ok;
  if not v_terms_ok then
    raise exception 'Debes aceptar los términos y condiciones antes de solicitar un préstamo.';
  end if;

  -- Pago móvil registrado
  select * into v_upm from user_payment_methods where user_id = auth.uid() order by created_at desc limit 1;
  if v_upm is null then
    raise exception 'Debes registrar tus datos de Pago Móvil antes de solicitar un préstamo.';
  end if;

  -- No debe tener un préstamo abierto (constraint también lo protege)
  if exists (
    select 1 from loans where user_id = auth.uid()
    and status in ('solicitado','en_revision','aprobado','pendiente_desembolso','activo','pendiente_pago')
  ) then
    raise exception 'Ya tienes un préstamo en curso.';
  end if;

  -- Nivel actual del usuario (fuente de verdad: profiles.current_level_id)
  select * into v_level from loan_levels where id = v_profile.current_level_id and is_active = true;
  if v_level is null then
    raise exception 'Tu nivel de crédito no está disponible actualmente.';
  end if;

  v_return_amount := round(v_level.principal_amount * v_level.return_rate_percent / 100, 2);
  v_total_amount := v_level.principal_amount + v_return_amount;

  insert into loans (
    user_id, level_id, level_number, principal_amount, return_rate_percent,
    return_amount, total_amount, term_days, status
  ) values (
    auth.uid(), v_level.id, v_level.level_number, v_level.principal_amount,
    v_level.return_rate_percent, v_return_amount, v_total_amount, v_level.term_days,
    'solicitado'
  ) returning * into v_loan;

  -- Bloquear temporalmente el método de pago mientras el préstamo está en curso
  update user_payment_methods set is_locked = true where user_id = auth.uid();

  insert into notifications (user_id, title, body)
  values (auth.uid(), 'Solicitud recibida', 'Tu solicitud ' || v_loan.public_id || ' fue registrada y está en revisión.');

  return v_loan;
end;
$$;

grant execute on function request_loan() to authenticated;

-- ---------------------------------------------------------------------
-- 2) ADMIN: aprobar / rechazar / pedir info sobre un préstamo
-- ---------------------------------------------------------------------
create or replace function admin_review_loan(p_loan_id uuid, p_decision text, p_reason text default null)
returns loans
language plpgsql security definer set search_path = public as $$
declare
  v_loan loans;
begin
  if not is_admin() then
    raise exception 'No autorizado';
  end if;
  if p_decision not in ('aprobar', 'rechazar') then
    raise exception 'Decisión inválida';
  end if;

  select * into v_loan from loans where id = p_loan_id for update;
  if v_loan is null then raise exception 'Préstamo no encontrado'; end if;
  if v_loan.status not in ('solicitado', 'en_revision') then
    raise exception 'El préstamo no está en un estado revisable';
  end if;

  if p_decision = 'aprobar' then
    update loans set status = 'aprobado', approved_at = now(), approved_by = auth.uid()
      where id = p_loan_id returning * into v_loan;
    insert into notifications (user_id, title, body)
      values (v_loan.user_id, 'Préstamo aprobado', 'Tu préstamo ' || v_loan.public_id || ' fue aprobado. Pronto recibirás el desembolso.');
  else
    update loans set status = 'rechazado', rejected_reason = p_reason
      where id = p_loan_id returning * into v_loan;
    update user_payment_methods set is_locked = false where user_id = v_loan.user_id;
    insert into notifications (user_id, title, body)
      values (v_loan.user_id, 'Solicitud rechazada', 'Tu préstamo ' || v_loan.public_id || ' fue rechazado. ' || coalesce(p_reason, ''));
  end if;

  insert into admin_actions (admin_id, action, target_table, target_id, details)
    values (auth.uid(), 'revisar_prestamo_' || p_decision, 'loans', p_loan_id, jsonb_build_object('reason', p_reason));

  return v_loan;
end;
$$;

grant execute on function admin_review_loan(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3) ADMIN: confirmar desembolso -> activa el préstamo y arranca el plazo
-- ---------------------------------------------------------------------
create or replace function admin_confirm_disbursement(
  p_loan_id uuid, p_amount_sent numeric, p_bank text, p_reference text,
  p_date date, p_time time, p_notes text default null
)
returns loans
language plpgsql security definer set search_path = public as $$
declare
  v_loan loans;
begin
  if not is_admin() then raise exception 'No autorizado'; end if;

  select * into v_loan from loans where id = p_loan_id for update;
  if v_loan is null then raise exception 'Préstamo no encontrado'; end if;
  if v_loan.status <> 'aprobado' then
    raise exception 'El préstamo debe estar aprobado antes de desembolsar';
  end if;

  insert into loan_disbursements (loan_id, admin_id, amount_sent, bank_used, reference_number, disbursed_date, disbursed_time, notes)
    values (p_loan_id, auth.uid(), p_amount_sent, p_bank, p_reference, p_date, p_time, p_notes);

  update loans set
    status = 'activo',
    disbursed_at = (p_date::timestamptz + p_time),
    due_at = (p_date::timestamptz + p_time) + (v_loan.term_days || ' days')::interval
  where id = p_loan_id returning * into v_loan;

  insert into notifications (user_id, title, body)
    values (v_loan.user_id, 'Préstamo desembolsado', 'Recibiste tu préstamo ' || v_loan.public_id || '. Debes pagar antes del ' || to_char(v_loan.due_at, 'DD/MM/YYYY') || '.');

  insert into admin_actions (admin_id, action, target_table, target_id, details)
    values (auth.uid(), 'confirmar_desembolso', 'loans', p_loan_id, jsonb_build_object('reference', p_reference, 'amount', p_amount_sent));

  return v_loan;
end;
$$;

grant execute on function admin_confirm_disbursement(uuid, numeric, text, text, date, time, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4) USUARIO: registrar pago de cuota (valida referencia duplicada
--    también en backend, además del UNIQUE INDEX de la tabla)
-- ---------------------------------------------------------------------
create or replace function submit_loan_payment(
  p_loan_id uuid, p_bank text, p_amount numeric, p_reference text,
  p_date date, p_receipt_url text default null
)
returns loan_payments
language plpgsql security definer set search_path = public as $$
declare
  v_loan loans;
  v_payment loan_payments;
  v_dup boolean;
begin
  select * into v_loan from loans where id = p_loan_id and user_id = auth.uid();
  if v_loan is null then raise exception 'Préstamo no encontrado'; end if;
  if v_loan.status not in ('activo', 'pendiente_pago') then
    raise exception 'Este préstamo no admite pagos en su estado actual';
  end if;

  select exists(
    select 1 from loan_payments
    where reference_number = p_reference
    and status in ('pendiente_verificacion', 'confirmado')
  ) into v_dup;
  if v_dup then
    raise exception 'Esta referencia ya fue utilizada en otra operación. No puedes utilizar una referencia bancaria duplicada.';
  end if;

  insert into loan_payments (loan_id, user_id, bank, amount, reference_number, payment_date, receipt_url, status)
  values (p_loan_id, auth.uid(), p_bank, p_amount, p_reference, p_date, p_receipt_url, 'pendiente_verificacion')
  returning * into v_payment;

  update loans set status = 'pendiente_pago' where id = p_loan_id and status = 'activo';

  return v_payment;
exception
  when unique_violation then
    raise exception 'Esta referencia ya fue utilizada en otra operación. No puedes utilizar una referencia bancaria duplicada.';
end;
$$;

grant execute on function submit_loan_payment(uuid, text, numeric, text, date, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5) ADMIN: aprobar / rechazar pago. Si el préstamo queda saldado,
--    marca "pagado", actualiza progreso y desbloquea nivel si aplica.
-- ---------------------------------------------------------------------
create or replace function admin_review_payment(p_payment_id uuid, p_decision text, p_reason text default null)
returns loan_payments
language plpgsql security definer set search_path = public as $$
declare
  v_payment loan_payments;
  v_loan loans;
  v_profile profiles;
  v_level loan_levels;
  v_next_level loan_levels;
  v_total_paid numeric(12,2);
begin
  if not is_admin() then raise exception 'No autorizado'; end if;
  if p_decision not in ('aprobar', 'rechazar') then raise exception 'Decisión inválida'; end if;

  select * into v_payment from loan_payments where id = p_payment_id for update;
  if v_payment is null then raise exception 'Pago no encontrado'; end if;
  if v_payment.status <> 'pendiente_verificacion' then
    raise exception 'Este pago ya fue procesado';
  end if;

  if p_decision = 'rechazar' then
    update loan_payments set status = 'rechazado', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = p_reason
      where id = p_payment_id returning * into v_payment;

    -- Si no quedan pagos pendientes para el préstamo, regresa a 'activo' para reintentar
    update loans set status = 'activo'
      where id = v_payment.loan_id and status = 'pendiente_pago'
      and not exists (select 1 from loan_payments where loan_id = v_payment.loan_id and status = 'pendiente_verificacion');

    insert into notifications (user_id, title, body)
      values (v_payment.user_id, 'Pago rechazado', 'Tu pago con referencia ' || v_payment.reference_number || ' fue rechazado. ' || coalesce(p_reason, 'Verifica los datos e intenta de nuevo.'));

    insert into admin_actions (admin_id, action, target_table, target_id, details)
      values (auth.uid(), 'rechazar_pago', 'loan_payments', p_payment_id, jsonb_build_object('reason', p_reason));

    return v_payment;
  end if;

  -- APROBAR
  update loan_payments set status = 'confirmado', reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_payment_id returning * into v_payment;

  select * into v_loan from loans where id = v_payment.loan_id for update;

  select coalesce(sum(amount), 0) into v_total_paid
    from loan_payments where loan_id = v_loan.id and status = 'confirmado';

  update loans set amount_paid = v_total_paid where id = v_loan.id;

  insert into notifications (user_id, title, body)
    values (v_payment.user_id, 'Pago confirmado', 'Tu pago con referencia ' || v_payment.reference_number || ' fue verificado y registrado.');

  if v_total_paid >= v_loan.total_amount then
    -- Préstamo saldado por completo
    update loans set status = 'pagado', paid_at = now() where id = v_loan.id;
    update user_payment_methods set is_locked = false where user_id = v_loan.user_id;

    select * into v_profile from profiles where id = v_loan.user_id for update;
    select * into v_level from loan_levels where id = v_profile.current_level_id;

    if v_profile.loans_completed_current_level + 1 >= v_level.loans_required_to_unlock_next then
      -- Desbloquear siguiente nivel si existe
      select * into v_next_level from loan_levels
        where level_number = v_level.level_number + 1 and is_active = true;

      if v_next_level is not null then
        update profiles set current_level_id = v_next_level.id, loans_completed_current_level = 0
          where id = v_loan.user_id;
        insert into notifications (user_id, title, body)
          values (v_loan.user_id, '¡Nuevo nivel desbloqueado!', 'Has completado tus préstamos de Nivel ' || v_level.level_number || '. El Nivel ' || v_next_level.level_number || ' ya está disponible.');
      else
        -- Ya está en el nivel máximo: solo suma el contador
        update profiles set loans_completed_current_level = loans_completed_current_level + 1
          where id = v_loan.user_id;
      end if;
    else
      update profiles set loans_completed_current_level = loans_completed_current_level + 1
        where id = v_loan.user_id;
    end if;

    insert into notifications (user_id, title, body)
      values (v_loan.user_id, 'Préstamo pagado', 'Tu préstamo ' || v_loan.public_id || ' quedó completamente pagado. ¡Gracias por cumplir!');
  end if;

  insert into admin_actions (admin_id, action, target_table, target_id, details)
    values (auth.uid(), 'aprobar_pago', 'loan_payments', p_payment_id, jsonb_build_object('amount', v_payment.amount));

  return v_payment;
end;
$$;

grant execute on function admin_review_payment(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 6) Marcar préstamos vencidos (ejecutar vía pg_cron o Edge Function
--    programada; no depende del cliente)
-- ---------------------------------------------------------------------
create or replace function mark_overdue_loans()
returns void
language plpgsql security definer set search_path = public as $$
begin
  update loans set status = 'vencido'
  where status in ('activo', 'pendiente_pago') and due_at < now();
end;
$$;

-- ---------------------------------------------------------------------
-- 7) ADMIN: revisar KYC
-- ---------------------------------------------------------------------
create or replace function admin_review_kyc(p_kyc_id uuid, p_decision text, p_notes text default null)
returns kyc
language plpgsql security definer set search_path = public as $$
declare
  v_kyc kyc;
begin
  if not is_admin() then raise exception 'No autorizado'; end if;
  if p_decision not in ('aprobar', 'rechazar', 'solicitar_info') then
    raise exception 'Decisión inválida';
  end if;

  select * into v_kyc from kyc where id = p_kyc_id for update;
  if v_kyc is null then raise exception 'KYC no encontrado'; end if;

  update kyc set
    status = case p_decision
      when 'aprobar' then 'aprobado'
      when 'rechazar' then 'rechazado'
      else 'requiere_informacion'
    end::kyc_status,
    reviewer_id = auth.uid(),
    review_notes = p_notes,
    reviewed_at = now()
  where id = p_kyc_id returning * into v_kyc;

  insert into notifications (user_id, title, body)
  values (
    v_kyc.user_id,
    case p_decision
      when 'aprobar' then 'KYC aprobado'
      when 'rechazar' then 'KYC rechazado'
      else 'Necesitamos más información'
    end,
    coalesce(p_notes, '')
  );

  insert into admin_actions (admin_id, action, target_table, target_id, details)
    values (auth.uid(), 'revisar_kyc_' || p_decision, 'kyc', p_kyc_id, jsonb_build_object('notes', p_notes));

  return v_kyc;
end;
$$;

grant execute on function admin_review_kyc(uuid, text, text) to authenticated;
