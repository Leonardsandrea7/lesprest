-- =====================================================================
-- LES PREST — Niveles con nombre/color + elegir monto entre lo desbloqueado
-- =====================================================================

alter table loan_levels
  add column display_name text,
  add column badge_color text;

update loan_levels set display_name = 'Bronce',   badge_color = '#a4643a' where level_number = 1;
update loan_levels set display_name = 'Plata',    badge_color = '#9aa3ab' where level_number = 2;
update loan_levels set display_name = 'Oro',      badge_color = '#d4a017' where level_number = 3;
update loan_levels set display_name = 'Platino',  badge_color = '#7c93c9' where level_number = 4;
update loan_levels set display_name = 'Diamante', badge_color = '#3fd0e0' where level_number = 5;
update loan_levels set display_name = 'Élite',    badge_color = '#c9377a' where level_number = 6;

-- ---------------------------------------------------------------------
-- request_loan(): ahora recibe qué nivel (monto) eligió el usuario,
-- que puede ser cualquiera de los que ya tiene desbloqueados (igual o
-- por debajo de su nivel actual), no obligatoriamente el más alto.
-- El progreso para subir de nivel sigue contando sobre su nivel real
-- (profiles.current_level_id), sin importar qué monto haya pedido.
-- ---------------------------------------------------------------------
drop function if exists request_loan(int);

create or replace function request_loan(p_level_number int, p_installments int default 1)
returns loans
language plpgsql security definer set search_path = public as $$
declare
  v_profile profiles;
  v_current_level loan_levels;
  v_chosen_level loan_levels;
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

  select * into v_current_level from loan_levels where id = v_profile.current_level_id and is_active = true;
  if v_current_level is null then raise exception 'Tu nivel de crédito no está disponible actualmente.'; end if;

  if p_level_number > v_current_level.level_number then
    raise exception 'Ese monto todavía no está desbloqueado para tu nivel actual.';
  end if;

  select * into v_chosen_level from loan_levels where level_number = p_level_number and is_active = true;
  if v_chosen_level is null then raise exception 'Nivel de préstamo no encontrado.'; end if;

  if p_installments <> 1 and (not v_chosen_level.allow_installments or not (p_installments = any(v_chosen_level.installment_choices))) then
    raise exception 'Ese número de cuotas no está disponible para el monto elegido.';
  end if;
  if p_installments = 1 and not (1 = any(v_chosen_level.installment_choices)) then
    raise exception 'Debes elegir un número de cuotas para el monto elegido.';
  end if;

  v_return_amount := round(v_chosen_level.principal_amount * v_chosen_level.return_rate_percent / 100, 2);
  v_total_amount := v_chosen_level.principal_amount + v_return_amount;

  insert into loans (
    user_id, level_id, level_number, principal_amount, return_rate_percent,
    return_amount, total_amount, term_days, status, installments_count
  ) values (
    auth.uid(), v_chosen_level.id, v_chosen_level.level_number, v_chosen_level.principal_amount,
    v_chosen_level.return_rate_percent, v_return_amount, v_total_amount, v_chosen_level.term_days,
    'solicitado', p_installments
  ) returning * into v_loan;

  update user_payment_methods set is_locked = true where user_id = auth.uid();

  insert into notifications (user_id, title, body)
  values (auth.uid(), 'Solicitud recibida', 'Tu solicitud ' || v_loan.public_id || ' fue registrada y está en revisión.');

  return v_loan;
end;
$$;

grant execute on function request_loan(int, int) to authenticated;
