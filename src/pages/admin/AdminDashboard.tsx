import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Card } from "../../components/ui";
import { formatMoney } from "../../lib/format";

interface Stats {
  totalUsers: number;
  kycPending: number;
  kycApproved: number;
  loansPending: number;
  loansActive: number;
  paymentsPending: number;
  loansPaid: number;
  loansOverdue: number;
  capitalLent: number;
  capitalRecovered: number;
  returnGenerated: number;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    async function load() {
      const [
        usersRes, kycPendingRes, kycApprovedRes,
        loansPendingRes, loansActiveRes, paymentsPendingRes,
        loansPaidRes, loansOverdueRes, loansAllRes,
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("kyc").select("id", { count: "exact", head: true }).in("status", ["pendiente", "en_revision", "requiere_informacion"]),
        supabase.from("kyc").select("id", { count: "exact", head: true }).eq("status", "aprobado"),
        supabase.from("loans").select("id", { count: "exact", head: true }).in("status", ["solicitado", "en_revision"]),
        supabase.from("loans").select("id", { count: "exact", head: true }).eq("status", "activo"),
        supabase.from("loan_payments").select("id", { count: "exact", head: true }).eq("status", "pendiente_verificacion"),
        supabase.from("loans").select("id", { count: "exact", head: true }).eq("status", "pagado"),
        supabase.from("loans").select("id", { count: "exact", head: true }).eq("status", "vencido"),
        supabase.from("loans").select("principal_amount, amount_paid, return_amount, status"),
      ]);

      const loans = (loansAllRes.data as { principal_amount: number; amount_paid: number; return_amount: number; status: string }[]) ?? [];
      const disbursedStatuses = ["activo", "pendiente_pago", "pagado", "vencido"];
      const capitalLent = loans.filter((l) => disbursedStatuses.includes(l.status)).reduce((sum, l) => sum + l.principal_amount, 0);
      const capitalRecovered = loans.reduce((sum, l) => sum + l.amount_paid, 0);
      const returnGenerated = loans.filter((l) => l.status === "pagado").reduce((sum, l) => sum + l.return_amount, 0);

      setStats({
        totalUsers: usersRes.count ?? 0,
        kycPending: kycPendingRes.count ?? 0,
        kycApproved: kycApprovedRes.count ?? 0,
        loansPending: loansPendingRes.count ?? 0,
        loansActive: loansActiveRes.count ?? 0,
        paymentsPending: paymentsPendingRes.count ?? 0,
        loansPaid: loansPaidRes.count ?? 0,
        loansOverdue: loansOverdueRes.count ?? 0,
        capitalLent,
        capitalRecovered,
        returnGenerated,
      });
    }
    load();
  }, []);

  if (!stats) return <p className="text-sm text-[var(--muted)]">Cargando métricas...</p>;

  const cards: { label: string; value: string }[] = [
    { label: "Usuarios totales", value: String(stats.totalUsers) },
    { label: "KYC pendientes", value: String(stats.kycPending) },
    { label: "KYC aprobados", value: String(stats.kycApproved) },
    { label: "Préstamos pendientes", value: String(stats.loansPending) },
    { label: "Préstamos activos", value: String(stats.loansActive) },
    { label: "Pagos pendientes", value: String(stats.paymentsPending) },
    { label: "Préstamos pagados", value: String(stats.loansPaid) },
    { label: "Préstamos vencidos", value: String(stats.loansOverdue) },
    { label: "Capital prestado", value: formatMoney(stats.capitalLent) },
    { label: "Capital recuperado", value: formatMoney(stats.capitalRecovered) },
    { label: "Retorno generado", value: formatMoney(stats.returnGenerated) },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">Resumen</h1>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <p className="text-xs text-[var(--muted)]">{c.label}</p>
            <p className="mt-1 font-display text-xl font-semibold text-[var(--ink)] tabular">{c.value}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
