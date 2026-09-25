import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import type {
  Kyc,
  Loan,
  LoanInstallment,
  LoanLevel,
  LoanPayment,
  UserPaymentMethod,
} from "../lib/database.types";

export interface UserLoanData {
  loading: boolean;
  error: string | null;
  currentLevel: LoanLevel | null;
  nextLevel: LoanLevel | null;
  unlockedLevels: LoanLevel[];
  kyc: Kyc | null;
  paymentMethod: UserPaymentMethod | null;
  hasAcceptedTerms: boolean;
  activeLoan: Loan | null; // cualquier préstamo no cerrado
  activeLoanInstallments: LoanInstallment[];
  loanHistory: Loan[];
  payments: LoanPayment[];
  refresh: () => Promise<void>;
}

const OPEN_STATUSES = ["solicitado", "en_revision", "aprobado", "pendiente_desembolso", "activo", "pendiente_pago"];

export function useUserLoanData(): UserLoanData {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentLevel, setCurrentLevel] = useState<LoanLevel | null>(null);
  const [nextLevel, setNextLevel] = useState<LoanLevel | null>(null);
  const [unlockedLevels, setUnlockedLevels] = useState<LoanLevel[]>([]);
  const [kyc, setKyc] = useState<Kyc | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<UserPaymentMethod | null>(null);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [activeLoan, setActiveLoan] = useState<Loan | null>(null);
  const [activeLoanInstallments, setActiveLoanInstallments] = useState<LoanInstallment[]>([]);
  const [loanHistory, setLoanHistory] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const [levelRes, kycRes, upmRes, termsRes, loansRes] = await Promise.all([
        profile.current_level_id
          ? supabase.from("loan_levels").select("*").eq("id", profile.current_level_id).single()
          : Promise.resolve({ data: null, error: null }),
        supabase.from("kyc").select("*").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("user_payment_methods").select("*").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("terms_acceptance").select("id").eq("user_id", profile.id).limit(1),
        supabase.from("loans").select("*").eq("user_id", profile.id).order("requested_at", { ascending: false }),
      ]);

      // Si alguna consulta fue rechazada por la base de datos (por ejemplo,
      // por una política de RLS), lo mostramos en vez de quedarnos "cargando"
      // para siempre.
      const firstError = [levelRes, kycRes, upmRes, termsRes, loansRes].find((r: any) => r.error)?.error;
      if (firstError) throw firstError;

      const level = (levelRes.data as LoanLevel | null) ?? null;
      setCurrentLevel(level);

      if (level) {
        const [{ data: next }, { data: unlocked }] = await Promise.all([
          supabase.from("loan_levels").select("*").eq("level_number", level.level_number + 1).maybeSingle(),
          supabase.from("loan_levels").select("*").lte("level_number", level.level_number).eq("is_active", true).order("level_number", { ascending: true }),
        ]);
        setNextLevel((next as LoanLevel | null) ?? null);
        setUnlockedLevels((unlocked as LoanLevel[] | null) ?? []);
      } else {
        setNextLevel(null);
        setUnlockedLevels([]);
      }

      setKyc((kycRes.data as Kyc | null) ?? null);
      setPaymentMethod((upmRes.data as UserPaymentMethod | null) ?? null);
      setHasAcceptedTerms(((termsRes.data as { id: string }[] | null)?.length ?? 0) > 0);

      const loans = (loansRes.data as Loan[] | null) ?? [];
      setLoanHistory(loans);
      const currentActiveLoan = loans.find((l) => OPEN_STATUSES.includes(l.status)) ?? null;
      setActiveLoan(currentActiveLoan);

      if (currentActiveLoan && currentActiveLoan.installments_count > 1) {
        const { data: installmentsData } = await supabase
          .from("loan_installments")
          .select("*")
          .eq("loan_id", currentActiveLoan.id)
          .order("installment_number", { ascending: true });
        setActiveLoanInstallments((installmentsData as LoanInstallment[] | null) ?? []);
      } else {
        setActiveLoanInstallments([]);
      }

      const loanIds = loans.map((l) => l.id);
      if (loanIds.length) {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from("loan_payments")
          .select("*")
          .in("loan_id", loanIds)
          .order("created_at", { ascending: false });
        if (paymentsError) throw paymentsError;
        setPayments((paymentsData as LoanPayment[] | null) ?? []);
      } else {
        setPayments([]);
      }
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error("useUserLoanData error:", err);
      setError(err?.message ?? "No se pudo cargar la información de tu cuenta.");
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Se refresca automáticamente cuando cambia cualquier préstamo del
  // usuario (aprobado, desembolsado, pagado, etc.), sin recargar la página.
  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel(`loans-changes-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "loans", filter: `user_id=eq.${profile.id}` },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "loans", filter: `user_id=eq.${profile.id}` },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loan_installments" },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kyc", filter: `user_id=eq.${profile.id}` },
        () => refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, refresh]);

  return {
    loading,
    error,
    currentLevel,
    nextLevel,
    unlockedLevels,
    kyc,
    paymentMethod,
    hasAcceptedTerms,
    activeLoan,
    activeLoanInstallments,
    loanHistory,
    payments,
    refresh,
  };
}
