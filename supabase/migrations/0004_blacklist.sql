-- =====================================================================
-- LES PREST — Lista negra por cédula (morosos)
-- =====================================================================
-- Implementa la cláusula 4 de los Términos y Condiciones: si un préstamo
-- no se paga dentro de 10 días + 3 de prórroga (13 días desde el
-- desembolso), la cédula asociada queda bloqueada para pedir nuevos
-- préstamos, sin importar si el usuario usa la misma cuenta, una cuenta
-- nueva, o un correo distinto — el bloqueo es por documento de identidad,
-- no por cuenta.
-- =====================================================================

create table document_blacklist (
  document_id text primary key,
  full_name text,
  reason text not null default 'Préstamo vencido sin pagar tras el plazo + prórroga',
  loan_id uuid references loans(id),
  blacklisted_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references profiles(id),
  removal_notes text
);

alter table document_blacklist enable row level security;

create policy "admin gestiona lista negra" on document_blacklist for all using (is_admin());
create policy "lectura de lista negra para verificacion" on document_blacklist for select using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------
-- Detecta préstamos vencidos más allá del plazo de prórroga y bloquea
-- la cédula correspondiente. Se recomienda ejecutar esta función a
-- diario mediante pg_cron; mientras tanto, hay un botón en
-- ADMIN → Préstamos para ejecutarla manualmente.
-- ---------------------------------------------------------------------
create or replace function mark_defaulters(p_prorroga_dias int default 3)
returns setof loans
language plpgsql security definer set search_path = public as $$
declare
  v_loan record;
begin
  if not is_admin() then
    raise exception 'No autorizado';
  end if;

  for v_loan in
    select l.*, k.document_id as kyc_document_id, k.full_name as kyc_full_name
    from loans l
    join kyc k on k.user_id = l.user_id and k.status = 'aprobado'
    where l.status in ('activo', 'pendiente_pago', 'vencido')
      and l.due_at is not null
      and l.due_at + (p_prorroga_dias || ' days')::interval < now()
      and l.amount_paid < l.total_amount
  loop
    update loans set status = 'vencido' where id = v_loan.id and status <> 'vencido';

    insert into document_blacklist (document_id, full_name, reason, loan_id)
    values (
      v_loan.kyc_document_id,
      v_loan.kyc_full_name,
      'Préstamo ' || v_loan.public_id || ' vencido: no pagado dentro del plazo + prórroga de ' || p_prorroga_dias || ' días.',
      v_loan.id
    )
    on conflict (document_id) do nothing;

    -- Bloquea toda cuenta (actual o futura) cuyo KYC use la misma cédula
    update profiles set is_blocked = true
    where id in (select user_id from kyc where document_id = v_loan.kyc_document_id);

    insert into admin_actions (admin_id, action, target_table, target_id, details)
    values (auth.uid(), 'agregar_lista_negra', 'loans', v_loan.id, jsonb_build_object('document_id', v_loan.kyc_document_id));

    return next v_loan;
  end loop;

  return;
end;
$$;

grant execute on function mark_defaulters(int) to authenticated;

-- ---------------------------------------------------------------------
-- ADMIN: quitar una cédula de la lista negra (cláusula 4.4: a criterio
-- exclusivo de LES PREST, por ejemplo tras regularizar la deuda).
-- ---------------------------------------------------------------------
create or replace function admin_remove_from_blacklist(p_document_id text, p_notes text default null)
returns document_blacklist
language plpgsql security definer set search_path = public as $$
declare
  v_row document_blacklist;
begin
  if not is_admin() then raise exception 'No autorizado'; end if;

  update document_blacklist
  set removed_at = now(), removed_by = auth.uid(), removal_notes = p_notes
  where document_id = p_document_id
  returning * into v_row;

  if v_row is null then raise exception 'Esa cédula no está en la lista negra'; end if;

  update profiles set is_blocked = false
  where id in (select user_id from kyc where document_id = p_document_id);

  insert into admin_actions (admin_id, action, target_table, target_id, details)
  values (auth.uid(), 'quitar_lista_negra', 'document_blacklist', null, jsonb_build_object('document_id', p_document_id, 'notes', p_notes));

  return v_row;
end;
$$;

grant execute on function admin_remove_from_blacklist(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Reforzar request_loan(): bloquear también por cédula en lista negra,
-- no solo por profiles.is_blocked (cubre el caso de una cuenta *nueva*
-- que aún no ha sido marcada is_blocked pero cuya cédula ya está en
-- la lista negra desde otra cuenta).
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
  v_blacklisted boolean;
begin
  select * into v_profile from profiles where id = auth.uid();
  if v_profile is null then
    raise exception 'Perfil no encontrado';
  end if;
  if v_profile.is_blocked then
    raise exception 'Tu cuenta está bloqueada. Contacta a soporte.';
  end if;

  select * into v_kyc from kyc
    where user_id = auth.uid() and status = 'aprobado'
    order by reviewed_at desc limit 1;
  if v_kyc is null then
    raise exception 'Debes completar y aprobar tu KYC antes de solicitar un préstamo.';
  end if;

  select exists(
    select 1 from document_blacklist
    where document_id = v_kyc.document_id and removed_at is null
  ) into v_blacklisted;
  if v_blacklisted then
    raise exception 'Tu cédula figura en la lista de incumplimiento de LES PREST. No es posible solicitar nuevos préstamos.';
  end if;

  select exists(select 1 from terms_acceptance where user_id = auth.uid()) into v_terms_ok;
  if not v_terms_ok then
    raise exception 'Debes aceptar los términos y condiciones antes de solicitar un préstamo.';
  end if;

  select * into v_upm from user_payment_methods where user_id = auth.uid() order by created_at desc limit 1;
  if v_upm is null then
    raise exception 'Debes registrar tus datos de Pago Móvil antes de solicitar un préstamo.';
  end if;

  if exists (
    select 1 from loans where user_id = auth.uid()
    and status in ('solicitado','en_revision','aprobado','pendiente_desembolso','activo','pendiente_pago')
  ) then
    raise exception 'Ya tienes un préstamo en curso.';
  end if;

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

  update user_payment_methods set is_locked = true where user_id = auth.uid();

  insert into notifications (user_id, title, body)
  values (auth.uid(), 'Solicitud recibida', 'Tu solicitud ' || v_loan.public_id || ' fue registrada y está en revisión.');

  return v_loan;
end;
$$;

-- ---------------------------------------------------------------------
-- Reforzar admin_review_kyc(): impedir aprobar un KYC cuya cédula ya
-- está en la lista negra (obliga al admin a rechazarlo explícitamente).
-- ---------------------------------------------------------------------
create or replace function admin_review_kyc(p_kyc_id uuid, p_decision text, p_notes text default null)
returns kyc
language plpgsql security definer set search_path = public as $$
declare
  v_kyc kyc;
  v_blacklisted boolean;
begin
  if not is_admin() then raise exception 'No autorizado'; end if;
  if p_decision not in ('aprobar', 'rechazar', 'solicitar_info') then
    raise exception 'Decisión inválida';
  end if;

  select * into v_kyc from kyc where id = p_kyc_id for update;
  if v_kyc is null then raise exception 'KYC no encontrado'; end if;

  if p_decision = 'aprobar' then
    select exists(
      select 1 from document_blacklist
      where document_id = v_kyc.document_id and removed_at is null
    ) into v_blacklisted;
    if v_blacklisted then
      raise exception 'Esta cédula está en la lista negra de LES PREST. No puede aprobarse un KYC con este documento.';
    end if;
  end if;

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
