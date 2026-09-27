import { supabase } from './supabase';

export interface LoanLevel {
  level: number;
  max_amount_usd: number;
  rate_percent: number;
  installments: number;
  interval_days: number;
  payments_to_advance: number;
}

export interface PayoutInfo {
  bank_name: string;
  phone: string;
  id_card: string;
  holder_name: string;
}

export const MAX_LEVEL = 6;

export const getLoanLevels = async (): Promise<LoanLevel[]> => {
  const { data, error } = await supabase.from('loan_levels').select('*').order('level', { ascending: true });
  if (error || !data || data.length === 0) {
    // Respaldo mínimo por si la tabla aún no fue migrada (evita que la app se rompa)
    return [{ level: 1, max_amount_usd: 1, rate_percent: 6, installments: 1, interval_days: 10, payments_to_advance: 2 }];
  }
  return data as LoanLevel[];
};

export const getBcvRate = async (): Promise<number> => {
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'bcv_rate').maybeSingle();
  return data ? parseFloat(data.value) || 54.25 : 54.25;
};

export const getPayoutInfo = async (): Promise<PayoutInfo> => {
  const { data } = await supabase
    .from('app_settings')
    .select('*')
    .in('key', ['payout_bank_name', 'payout_phone', 'payout_id_card', 'payout_holder_name']);

  const map: Record<string, string> = {};
  data?.forEach((s: any) => (map[s.key] = s.value));

  return {
    bank_name: map.payout_bank_name || 'Por definir',
    phone: map.payout_phone || 'Por definir',
    id_card: map.payout_id_card || 'Por definir',
    holder_name: map.payout_holder_name || 'PrestApp'
  };
};

export const calcLoanForLevel = (level: LoanLevel, bcvRate: number) => {
  const amountUsd = Number(level.max_amount_usd);
  const interestUsd = Number((amountUsd * (level.rate_percent / 100)).toFixed(2));
  const totalDueUsd = Number((amountUsd + interestUsd).toFixed(2));
  const amountVes = Number((amountUsd * bcvRate).toFixed(2));
  const totalDueVes = Number((totalDueUsd * bcvRate).toFixed(2));
  return {
    amountUsd,
    interestUsd,
    totalDueUsd,
    amountVes,
    totalDueVes,
    termDays: level.interval_days,
    installments: level.installments
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
export const hasActiveLoan = (loans: any[]) => loans.some((l) => ACTIVE_LOAN_STATUSES.includes(l.status));

export const requestLoan = async (userId: string, level: LoanLevel, bcvRate: number) => {
  const calc = calcLoanForLevel(level, bcvRate);
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
        bcv_rate: bcvRate,
        level_borrowed: level.level,
        term_days: calc.termDays,
        installments: calc.installments,
        due_date: dueDate,
        status: 'pendiente'
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};

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

export const updateMyProfile = async (
  userId: string,
  fields: { full_name?: string; phone?: string; bank_name?: string }
) => {
  const { error } = await supabase.from('profiles').update(fields).eq('id', userId);
  if (error) throw error;
};
