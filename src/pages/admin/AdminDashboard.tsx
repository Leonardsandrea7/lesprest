import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { Card } from "../../components/ui";
import { formatMoney } from "../../lib/format";

interface Stats {
  totalUsers: number;
  kycPending: number;
  loansPending: number;
  paymentsPending: number;
  loansActive: number;
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
        usersRes, kycPendingRes,
        loansPendingRes, loansActiveRes, paymentsPendingRes,
        loansPaidRes, loansOverdueRes, loansAllRes,
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("kyc").select("id", { count: "exact", head: true }).in("status", ["pendiente", "en_revision", "requiere_informacion"]),
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

  const pendingActions = [
    { label: "KYC por revisar", value: stats.kycPending, to: "/admin/kyc" },
    { label: "Préstamos por aprobar", value: stats.loansPending, to: "/admin/prestamos" },
    { label: "Pagos por verificar", value: stats.paymentsPending, to: "/admin/pagos" },
  ];

  const metrics = [
    { label: "Usuarios totales", value: String(stats.totalUsers) },
    { label: "Préstamos activos", value: String(stats.loansActive) },
    { label: "Préstamos pagados", value: String(stats.loansPaid) },
    { label: "Préstamos vencidos", value: String(stats.loansOverdue) },
    { label: "Capital prestado", value: formatMoney(stats.capitalLent) },
    { label: "Capital recuperado", value: formatMoney(stats.capitalRecovered) },
    { label: "Retorno generado", value: formatMoney(stats.returnGenerated) },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-[var(--ink)]">Resumen</h1>

      <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Pendiente de atender</p>
      <div className="mt-2 grid grid-cols-3 gap-3">
        {pendingActions.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className={`rounded-2xl border p-4 text-center transition-colors ${
              a.value > 0 ? "border-[var(--brand)] bg-[var(--brand)]/5 hover:bg-[var(--brand)]/10" : "border-[var(--line)]"
            }`}
          >
            <p className={`font-display text-2xl font-bold tabular ${a.value > 0 ? "text-[var(--brand)]" : "text-[var(--muted)]"}`}>
              {a.value}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">{a.label}</p>
          </Link>
        ))}
      </div>

      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Números del negocio</p>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {metrics.map((c) => (
          <Card key={c.label}>
            <p className="text-xs text-[var(--muted)]">{c.label}</p>
            <p className="mt-1 font-display text-xl font-semibold text-[var(--ink)] tabular">{c.value}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
