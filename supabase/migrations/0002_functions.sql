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
