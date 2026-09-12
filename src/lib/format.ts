import { format, differenceInCalendarDays } from "date-fns";
import { es } from "date-fns/locale";
import type { LoanStatus, KycStatus, PaymentStatus } from "./database.types";

export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatBs(usdAmount: number, rate: number | null): string {
  if (!rate || rate <= 0) return "—";
  const bs = usdAmount * rate;
  return `Bs. ${bs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateIso: string | null): string {
  if (!dateIso) return "—";
  return format(new Date(dateIso), "dd/MM/yyyy", { locale: es });
}

export function formatDateTime(dateIso: string | null): string {
  if (!dateIso) return "—";
  return format(new Date(dateIso), "dd/MM/yyyy hh:mm a", { locale: es });
}

export function daysRemaining(dueAt: string | null): number | null {
  if (!dueAt) return null;
  return differenceInCalendarDays(new Date(dueAt), new Date());
}

export const loanStatusLabels: Record<LoanStatus, string> = {
  solicitado: "Solicitado",
  en_revision: "En revisión",
  aprobado: "Aprobado — pendiente de desembolso",
  pendiente_desembolso: "Pendiente de desembolso",
  activo: "Activo",
  pendiente_pago: "Pendiente de verificación de pago",
  pagado: "Pagado",
  vencido: "Vencido",
  rechazado: "Rechazado",
};

export const loanStatusColors: Record<LoanStatus, string> = {
  solicitado: "bg-amber-100 text-amber-800",
  en_revision: "bg-amber-100 text-amber-800",
  aprobado: "bg-sky-100 text-sky-800",
  pendiente_desembolso: "bg-sky-100 text-sky-800",
  activo: "bg-blue-100 text-blue-800",
  pendiente_pago: "bg-amber-100 text-amber-800",
  pagado: "bg-blue-100 text-blue-800",
  vencido: "bg-red-100 text-red-800",
  rechazado: "bg-red-100 text-red-800",
};

export const kycStatusLabels: Record<KycStatus, string> = {
  pendiente: "Pendiente",
  en_revision: "En revisión",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  requiere_informacion: "Requiere información",
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  pendiente_verificacion: "Pendiente de verificación",
  confirmado: "Confirmado",
  rechazado: "Rechazado",
};

export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template
    .replaceAll("[Nombre]", vars.nombre ?? "")
    .replaceAll("[Monto]", vars.monto ?? "")
    .replaceAll("[Nivel]", vars.nivel ?? "")
    .replaceAll("[Fecha]", vars.fecha ?? "")
    .replaceAll("[ID]", vars.id ?? "");
}

export function whatsappLink(phone: string, message: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
