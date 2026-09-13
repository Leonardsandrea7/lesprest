-- =====================================================================
-- LES PREST — Sistema de cuotas (2 o 3 pagos) desde el nivel que
-- el admin decida
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Configuración por nivel: qué opciones de cuotas se permiten
-- ---------------------------------------------------------------------
alter table loan_levels
  add column allow_installments boolean not null default false,
  add column installment_choices int[] not null default '{1}';

-- Niveles 1 y 2 se quedan en pago único. Del nivel 3 en adelante, el
-- usuario puede elegir pagar todo de una vez, en 2 cuotas, o en 3.
update loan_levels set allow_installments = false, installment_choices = '{1}' where level_number in (1, 2);
update loan_levels set allow_installments = true, installment_choices = '{1,2,3}' where level_number >= 3;

-- ---------------------------------------------------------------------
-- 2) Tabla de cuotas individuales de cada préstamo
-- ---------------------------------------------------------------------
create type installment_status as enum ('pendiente', 'pendiente_pago', 'pagada', 'vencida');

create table loan_installments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans(id) on delete cascade,
  installment_number int not null,
  amount numeric(12,2) not null,
  due_at timestamptz not null,
  status installment_status not null default 'pendiente',
  amount_paid numeric(12,2) not null default 0,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (loan_id, installment_number)
);
create index idx_installments_loan on loan_installments(loan_id);

alter table loan_installments enable row level security;

create policy "usuario ve cuotas de sus prestamos" on loan_installments for select
  using (is_admin() or exists (select 1 from loans l where l.id = loan_id and l.user_id = auth.uid()));
create policy "admin gestiona cuotas" on loan_installments for all using (is_admin());

-- ---------------------------------------------------------------------
-- 3) Nuevas columnas de referencia
-- ---------------------------------------------------------------------
alter table loans add column installments_count int not null default 1;
alter table loan_payments add column installment_id uuid references loan_installments(id);

-- ---------------------------------------------------------------------
-- 4) request_loan(): ahora recibe cuántas cuotas eligió el usuario
-- ---------------------------------------------------------------------
create or replace function request_loan(p_installments int default 1)
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
  if v_profile is null then raise exception 'Perfil no encontrado'; end if;
  if v_profile.is_blocked then raise exception 'Tu cuenta está bloqueada. Contacta a soporte.'; end if;

  select * into v_kyc from kyc
    where user_id = auth.uid() and status = 'aprobado'
    order by reviewed_at desc limit 1;
  if v_kyc is null then raise exception 'Debes completar y aprobar tu KYC antes de solicitar un préstamo.'; end if;

  select exists(
    select 1 from document_blacklist where document_id = v_kyc.document_id and removed_at is null
  ) into v_blacklisted;
  if v_blacklisted then
    raise exception 'Tu cédula figura en la lista de incumplimiento de LES PREST. No es posible solicitar nuevos préstamos.';
  end if;

  select exists(select 1 from terms_acceptance where user_id = auth.uid()) into v_terms_ok;
  if not v_terms_ok then raise exception 'Debes aceptar los términos y condiciones antes de solicitar un préstamo.'; end if;

  select * into v_upm from user_payment_methods where user_id = auth.uid() order by created_at desc limit 1;
  if v_upm is null then raise exception 'Debes registrar tus datos de Pago Móvil antes de solicitar un préstamo.'; end if;

  if exists (
    select 1 from loans where user_id = auth.uid()
    and status in ('solicitado','en_revision','aprobado','pendiente_desembolso','activo','pendiente_pago')
  ) then
    raise exception 'Ya tienes un préstamo en curso.';
  end if;

  select * into v_level from loan_levels where id = v_profile.current_level_id and is_active = true;
  if v_level is null then raise exception 'Tu nivel de crédito no está disponible actualmente.'; end if;

  if p_installments <> 1 and (not v_level.allow_installments or not (p_installments = any(v_level.installment_choices))) then
    raise exception 'Ese número de cuotas no está disponible para tu nivel actual.';
  end if;
  if p_installments = 1 and not (1 = any(v_level.installment_choices)) then
    raise exception 'Debes elegir un número de cuotas para tu nivel actual.';
  end if;

  v_return_amount := round(v_level.principal_amount * v_level.return_rate_percent / 100, 2);
  v_total_amount := v_level.principal_amount + v_return_amount;

  insert into loans (
    user_id, level_id, level_number, principal_amount, return_rate_percent,
    return_amount, total_amount, term_days, status, installments_count
  ) values (
    auth.uid(), v_level.id, v_level.level_number, v_level.principal_amount,
    v_level.return_rate_percent, v_return_amount, v_total_amount, v_level.term_days,
    'solicitado', p_installments
  ) returning * into v_loan;

  update user_payment_methods set is_locked = true where user_id = auth.uid();

  insert into notifications (user_id, title, body)
  values (auth.uid(), 'Solicitud recibida', 'Tu solicitud ' || v_loan.public_id || ' fue registrada y está en revisión.');

  return v_loan;
end;
$$;

grant execute on function request_loan(int) to authenticated;

-- ---------------------------------------------------------------------
-- 5) admin_confirm_disbursement(): ahora también genera las cuotas,
-- repartiendo el total en partes iguales (el último ajuste absorbe el
-- redondeo, para que la suma siempre cuadre exacto con el total).
-- ---------------------------------------------------------------------
create or replace function admin_confirm_disbursement(
  p_loan_id uuid, p_amount_sent numeric, p_bank text, p_reference text,
  p_date date, p_time time, p_notes text default null
)
returns loans
language plpgsql security definer set search_path = public as $$
declare
  v_loan loans;
  v_disbursed_at timestamptz;
  v_due_at timestamptz;
  v_n int;
  v_amount_each numeric(12,2);
  v_accumulated numeric(12,2) := 0;
  v_this_due timestamptz;
  i int;
begin
  if not is_admin() then raise exception 'No autorizado'; end if;

  select * into v_loan from loans where id = p_loan_id for update;
  if v_loan is null then raise exception 'Préstamo no encontrado'; end if;
  if v_loan.status <> 'aprobado' then raise exception 'El préstamo debe estar aprobado antes de desembolsar'; end if;

  insert into loan_disbursements (loan_id, admin_id, amount_sent, bank_used, reference_number, disbursed_date, disbursed_time, notes)
    values (p_loan_id, auth.uid(), p_amount_sent, p_bank, p_reference, p_date, p_time, p_notes);

  v_disbursed_at := (p_date::timestamptz + p_time);
  v_due_at := v_disbursed_at + (v_loan.term_days || ' days')::interval;

  update loans set status = 'activo', disbursed_at = v_disbursed_at, due_at = v_due_at
    where id = p_loan_id returning * into v_loan;

  v_n := v_loan.installments_count;
  v_amount_each := round(v_loan.total_amount / v_n, 2);

  for i in 1..v_n loop
    v_this_due := v_disbursed_at + ((v_loan.term_days::numeric * i / v_n) || ' days')::interval;
    insert into loan_installments (loan_id, installment_number, amount, due_at, status)
    values (
      p_loan_id,
      i,
      case when i = v_n then v_loan.total_amount - v_accumulated else v_amount_each end,
      v_this_due,
      'pendiente'
    );
    v_accumulated := v_accumulated + v_amount_each;
  end loop;

  insert into notifications (user_id, title, body)
    values (v_loan.user_id, 'Préstamo desembolsado', 'Recibiste tu préstamo ' || v_loan.public_id || '. Debes pagar antes del ' || to_char(v_due_at, 'DD/MM/YYYY') || '.');

  insert into admin_actions (admin_id, action, target_table, target_id, details)
    values (auth.uid(), 'confirmar_desembolso', 'loans', p_loan_id, jsonb_build_object('reference', p_reference, 'amount', p_amount_sent, 'cuotas', v_n));

  return v_loan;
end;
$$;

grant execute on function admin_confirm_disbursement(uuid, numeric, text, text, date, time, text) to authenticated;

-- ---------------------------------------------------------------------
-- 6) submit_loan_payment(): ahora asociado a una cuota específica
-- ---------------------------------------------------------------------
create or replace function submit_loan_payment(
  p_loan_id uuid, p_bank text, p_amount numeric, p_reference text,
  p_date date, p_installment_id uuid default null, p_receipt_url text default null
)
returns loan_payments
language plpgsql security definer set search_path = public as $$
declare
  v_loan loans;
  v_installment loan_installments;
  v_payment loan_payments;
  v_dup boolean;
begin
  select * into v_loan from loans where id = p_loan_id and user_id = auth.uid();
  if v_loan is null then raise exception 'Préstamo no encontrado'; end if;
  if v_loan.status not in ('activo', 'pendiente_pago', 'vencido') then
    raise exception 'Este préstamo no admite pagos en su estado actual';
  end if;

  if p_installment_id is not null then
    select * into v_installment from loan_installments where id = p_installment_id and loan_id = p_loan_id for update;
    if v_installment is null then raise exception 'Cuota no encontrada'; end if;
    if v_installment.status not in ('pendiente', 'vencida') then
      raise exception 'Esta cuota ya fue pagada o está en verificación';
    end if;
  end if;

  select exists(
    select 1 from loan_payments
    where reference_number = p_reference
    and status in ('pendiente_verificacion', 'confirmado')
  ) into v_dup;
  if v_dup then
    raise exception 'Esta referencia ya fue utilizada en otra operación. No puedes utilizar una referencia bancaria duplicada.';
  end if;

  insert into loan_payments (loan_id, user_id, bank, amount, reference_number, payment_date, receipt_url, status, installment_id)
  values (p_loan_id, auth.uid(), p_bank, p_amount, p_reference, p_date, p_receipt_url, 'pendiente_verificacion', p_installment_id)
  returning * into v_payment;

  update loans set status = 'pendiente_pago' where id = p_loan_id and status in ('activo', 'vencido');
  if p_installment_id is not null then
    update loan_installments set status = 'pendiente_pago' where id = p_installment_id;
  end if;

  return v_payment;
exception
  when unique_violation then
    raise exception 'Esta referencia ya fue utilizada en otra operación. No puedes utilizar una referencia bancaria duplicada.';
end;
$$;

grant execute on function submit_loan_payment(uuid, text, numeric, text, date, uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 7) admin_review_payment(): al aprobar, marca la cuota como pagada; si
-- quedan cuotas pendientes, el préstamo vuelve a "activo" para que el
-- usuario pague la siguiente; si todas están pagadas, el préstamo queda
-- "pagado" y se aplica la misma lógica de nivel de siempre.
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
  v_pending_installments int;
begin
  if not is_admin() then raise exception 'No autorizado'; end if;
  if p_decision not in ('aprobar', 'rechazar') then raise exception 'Decisión inválida'; end if;

  select * into v_payment from loan_payments where id = p_payment_id for update;
  if v_payment is null then raise exception 'Pago no encontrado'; end if;
  if v_payment.status <> 'pendiente_verificacion' then raise exception 'Este pago ya fue procesado'; end if;

  if p_decision = 'rechazar' then
    update loan_payments set status = 'rechazado', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = p_reason
      where id = p_payment_id returning * into v_payment;

    if v_payment.installment_id is not null then
      update loan_installments set status = 'pendiente' where id = v_payment.installment_id and status = 'pendiente_pago';
    end if;

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

  if v_payment.installment_id is not null then
    update loan_installments
      set status = 'pagada', amount_paid = v_payment.amount, paid_at = now()
      where id = v_payment.installment_id;
  end if;

  select coalesce(sum(amount), 0) into v_total_paid
    from loan_payments where loan_id = v_loan.id and status = 'confirmado';
  update loans set amount_paid = v_total_paid where id = v_loan.id;

  insert into notifications (user_id, title, body)
    values (v_payment.user_id, 'Pago confirmado', 'Tu pago con referencia ' || v_payment.reference_number || ' fue verificado y registrado.');

  -- ¿Quedan cuotas sin pagar? (si el préstamo no usa cuotas, esta
  -- consulta simplemente no encuentra filas y se comporta como antes)
  select count(*) into v_pending_installments
    from loan_installments where loan_id = v_loan.id and status <> 'pagada';

  if (v_loan.installments_count > 1 and v_pending_installments = 0)
     or (v_loan.installments_count = 1 and v_total_paid >= v_loan.total_amount) then
    -- Préstamo saldado por completo
    update loans set status = 'pagado', paid_at = now() where id = v_loan.id;
    update user_payment_methods set is_locked = false where user_id = v_loan.user_id;

    select * into v_profile from profiles where id = v_loan.user_id for update;
    select * into v_level from loan_levels where id = v_profile.current_level_id;

    if v_profile.loans_completed_current_level + 1 >= v_level.loans_required_to_unlock_next then
      select * into v_next_level from loan_levels where level_number = v_level.level_number + 1 and is_active = true;
      if v_next_level is not null then
        update profiles set current_level_id = v_next_level.id, loans_completed_current_level = 0 where id = v_loan.user_id;
        insert into notifications (user_id, title, body)
          values (v_loan.user_id, '¡Nuevo nivel desbloqueado!', 'Has completado tus préstamos de Nivel ' || v_level.level_number || '. El Nivel ' || v_next_level.level_number || ' ya está disponible.');
      else
        update profiles set loans_completed_current_level = loans_completed_current_level + 1 where id = v_loan.user_id;
      end if;
    else
      update profiles set loans_completed_current_level = loans_completed_current_level + 1 where id = v_loan.user_id;
    end if;

    insert into notifications (user_id, title, body)
      values (v_loan.user_id, 'Préstamo pagado', 'Tu préstamo ' || v_loan.public_id || ' quedó completamente pagado. ¡Gracias por cumplir!');
  else
    -- Todavía quedan cuotas: el préstamo vuelve a "activo" para que
    -- el usuario pueda pagar la siguiente.
    update loans set status = 'activo' where id = v_loan.id and status = 'pendiente_pago';
  end if;

  insert into admin_actions (admin_id, action, target_table, target_id, details)
    values (auth.uid(), 'aprobar_pago', 'loan_payments', p_payment_id, jsonb_build_object('amount', v_payment.amount));

  return v_payment;
end;
$$;

grant execute on function admin_review_payment(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 8) mark_defaulters(): para préstamos con cuotas, se basa en el
-- vencimiento de la ÚLTIMA cuota pendiente (no castiga por atrasarse
-- unos días en una cuota si el resto del calendario aún no vence).
-- ---------------------------------------------------------------------
create or replace function mark_defaulters(p_prorroga_dias int default 3)
returns setof loans
language plpgsql security definer set search_path = public as $$
declare
  v_loan record;
begin
  if not is_admin() then raise exception 'No autorizado'; end if;

  for v_loan in
    select l.*, k.document_id as kyc_document_id, k.full_name as kyc_full_name,
      coalesce(
        (select max(li.due_at) from loan_installments li where li.loan_id = l.id and li.status <> 'pagada'),
        l.due_at
      ) as effective_due_at
    from loans l
    join kyc k on k.user_id = l.user_id and k.status = 'aprobado'
    where l.status in ('activo', 'pendiente_pago', 'vencido')
      and l.amount_paid < l.total_amount
  loop
    if v_loan.effective_due_at is null or v_loan.effective_due_at + (p_prorroga_dias || ' days')::interval >= now() then
      continue;
    end if;

    update loans set status = 'vencido' where id = v_loan.id and status <> 'vencido';
    update loan_installments set status = 'vencida' where loan_id = v_loan.id and status in ('pendiente', 'pendiente_pago') and due_at < now();

    insert into document_blacklist (document_id, full_name, reason, loan_id)
    values (
      v_loan.kyc_document_id,
      v_loan.kyc_full_name,
      'Préstamo ' || v_loan.public_id || ' vencido: no pagado dentro del plazo + prórroga de ' || p_prorroga_dias || ' días.',
      v_loan.id
    )
    on conflict (document_id) do nothing;

    update profiles set is_blocked = true
    where id in (select user_id from kyc where document_id = v_loan.kyc_document_id);

    insert into admin_actions (admin_id, action, target_table, target_id, details)
      values (auth.uid(), 'agregar_lista_negra', 'loans', v_loan.id, jsonb_build_object('document_id', v_loan.kyc_document_id));

    return next v_loan;
  end loop;

  return;
end;
$$;
