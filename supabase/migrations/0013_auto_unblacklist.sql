-- =====================================================================
-- LES PREST — Desbloqueo automático al pagar la deuda completa
-- =====================================================================
-- Antes, salir de la lista negra requería que un admin lo hiciera
-- manualmente. Ahora, en cuanto un préstamo que causó el bloqueo queda
-- completamente pagado, se quita solo de la lista negra.
-- =====================================================================

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

  select count(*) into v_pending_installments
    from loan_installments where loan_id = v_loan.id and status <> 'pagada';

  if (v_loan.installments_count > 1 and v_pending_installments = 0)
     or (v_loan.installments_count = 1 and v_total_paid >= v_loan.total_amount) then
    -- Préstamo saldado por completo
    update loans set status = 'pagado', paid_at = now() where id = v_loan.id;
    update user_payment_methods set is_locked = false where user_id = v_loan.user_id;

    -- Si este préstamo era el motivo de un bloqueo por mora, se quita
    -- automáticamente de la lista negra al quedar saldado.
    update document_blacklist
      set removed_at = now(), removal_notes = 'Deuda regularizada: préstamo pagado en su totalidad.'
      where loan_id = v_loan.id and removed_at is null;

    if exists (select 1 from document_blacklist db2 where db2.loan_id = v_loan.id) then
      update profiles set is_blocked = false where id = v_loan.user_id;
    end if;

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
    update loans set status = 'activo' where id = v_loan.id and status = 'pendiente_pago';
  end if;

  insert into admin_actions (admin_id, action, target_table, target_id, details)
    values (auth.uid(), 'aprobar_pago', 'loan_payments', p_payment_id, jsonb_build_object('amount', v_payment.amount));

  return v_payment;
end;
$$;
