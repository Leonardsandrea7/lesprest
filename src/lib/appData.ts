import { supabase } from './supabase';

export interface AppSettings {
  bcv_rate: number;
  level1_max_amount: number;
  level1_rate_percent: number;
  level1_installments: number;
  level1_interval_days: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  bcv_rate: 54.25,
  level1_max_amount: 1,
  level1_rate_percent: 6,
  level1_installments: 1,
  level1_interval_days: 10
};

export const getSettings = async (): Promise<AppSettings> => {
  const { data } = await supabase.from('app_settings').select('*');
  const settings = { ...DEFAULT_SETTINGS };
  data?.forEach((s: any) => {
    if (s.key === 'bcv_rate') settings.bcv_rate = parseFloat(s.value) || settings.bcv_rate;
    if (s.key === 'level1_max_amount') settings.level1_max_amount = parseFloat(s.value) || settings.level1_max_amount;
    if (s.key === 'level1_rate_percent') settings.level1_rate_percent = parseFloat(s.value) || settings.level1_rate_percent;
    if (s.key === 'level1_installments') settings.level1_installments = parseFloat(s.value) || settings.level1_installments;
    if (s.key === 'level1_interval_days') settings.level1_interval_days = parseFloat(s.value) || settings.level1_interval_days;
  });
  return settings;
};

/**
 * Calcula el monto disponible para un nivel dado.
 * NOTA / LIMITACIÓN CONOCIDA: hoy en Admin solo se configuran los parámetros
 * del Nivel 1. Mientras no exista una tabla/pantalla de "niveles" independiente,
 * se usa una regla simple de crecimiento (se duplica el monto por cada nivel
 * alcanzado) manteniendo el mismo % de interés, cuotas y plazo del Nivel 1.
 * Cuando quieras ofrecer montos/plazos distintos por nivel, lo correcto es
 * agregar una tabla `loan_levels` y un formulario en Admin para editarla.
 */
export const calcLoanForLevel = (settings: AppSettings, level: number) => {
  const amountUsd = Number((settings.level1_max_amount * Math.pow(2, Math.max(level, 1) - 1)).toFixed(2));
  const interestUsd = Number((amountUsd * (settings.level1_rate_percent / 100)).toFixed(2));
  const totalDueUsd = Number((amountUsd + interestUsd).toFixed(2));
  const amountVes = Number((amountUsd * settings.bcv_rate).toFixed(2));
  const totalDueVes = Number((totalDueUsd * settings.bcv_rate).toFixed(2));
  return {
    amountUsd,
    interestUsd,
    totalDueUsd,
    amountVes,
    totalDueVes,
    termDays: settings.level1_interval_days
  };
};

export const getMyLoans = async (userId: string) => {
  const { data, error } = await supabase
    .from('loans')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const getMyPayments = async (userId: string) => {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

export const getMyNotifications = async (userId: string) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
};

export const markNotificationRead = async (id: string) => {
  await supabase.from('notifications').update({ is_read: true }).eq('id', id);
};

const ACTIVE_LOAN_STATUSES = ['pendiente', 'aprobado', 'desembolsado'];

export const requestLoan = async (userId: string, level: number) => {
  const settings = await getSettings();
  const calc = calcLoanForLevel(settings, level);
  const dueDate = new Date(Date.now() + calc.termDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('loans')
    .insert([
      {
        user_id: userId,
        amount_usd: calc.amountUsd,
        amount_ves: calc.amountVes,
        interest_usd: calc.interestUsd,
        total_due_usd: calc.totalDueUsd,
        total_due_ves: calc.totalDueVes,
        bcv_rate: settings.bcv_rate,
        level_borrowed: level,
        term_days: calc.termDays,
        due_date: dueDate,
        status: 'pendiente'
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const hasActiveLoan = (loans: any[]) => loans.some((l) => ACTIVE_LOAN_STATUSES.includes(l.status));

export const reportPayment = async (
  userId: string,
  loanId: string,
  reference: string,
  amountUsd: number,
  bcvRate: number
) => {
  const { data, error } = await supabase
    .from('payments')
    .insert([
      {
        user_id: userId,
        loan_id: loanId,
        reference: reference.trim(),
        amount_usd: amountUsd,
        amount_ves: Number((amountUsd * bcvRate).toFixed(2)),
        bcv_rate: bcvRate,
        status: 'pendiente'
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};
