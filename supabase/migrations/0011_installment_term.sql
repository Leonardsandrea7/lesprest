-- =====================================================================
-- LES PREST — Plazo proporcional al número de cuotas
-- =====================================================================
-- Antes, `term_days` de cada nivel era el plazo TOTAL fijo (10 días),
-- sin importar en cuántas cuotas se pagara — lo que apretaba mucho las
-- fechas al elegir 2 o 3 cuotas. Ahora `term_days` representa los días
-- POR CUOTA: si el nivel tiene term_days = 10 y el usuario elige 3
-- cuotas, el plazo total pasa a ser 30 días (10 + 10 + 10).
-- =====================================================================

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
  v_n := v_loan.installments_count;

  -- El plazo total ahora es "días por cuota" x "número de cuotas".
  v_due_at := v_disbursed_at + ((v_loan.term_days * v_n) || ' days')::interval;

  update loans set status = 'activo', disbursed_at = v_disbursed_at, due_at = v_due_at
    where id = p_loan_id returning * into v_loan;

  v_amount_each := round(v_loan.total_amount / v_n, 2);

  for i in 1..v_n loop
    -- Cada cuota vence "term_days" después de la anterior (10, 20, 30...).
    v_this_due := v_disbursed_at + ((v_loan.term_days * i) || ' days')::interval;
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
    values (auth.uid(), 'confirmar_desembolso', 'loans', p_loan_id, jsonb_build_object('reference', p_reference, 'amount', p_amount_sent, 'cuotas', v_n, 'dias_totales', v_loan.term_days * v_n));

  return v_loan;
end;
$$;
