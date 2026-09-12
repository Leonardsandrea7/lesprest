// Tipos manuales que reflejan el esquema de supabase/migrations/0001_schema.sql
// En producción, reemplazar por: `supabase gen types typescript` para mantener
// sincronía automática con la base de datos real.

export type AppRole = "user" | "admin" | "superadmin";

export type KycStatus =
  | "pendiente"
  | "en_revision"
  | "aprobado"
  | "rechazado"
  | "requiere_informacion";

export type LoanStatus =
  | "solicitado"
  | "en_revision"
  | "aprobado"
  | "pendiente_desembolso"
  | "activo"
  | "pendiente_pago"
  | "pagado"
  | "vencido"
  | "rechazado";

export type PaymentStatus = "pendiente_verificacion" | "confirmado" | "rechazado";

export interface Profile {
  id: string;
  role: AppRole;
  full_name: string | null;
  current_level_id: string | null;
  loans_completed_current_level: number;
  is_blocked: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoanLevel {
  id: string;
  level_number: number;
  principal_amount: number;
  return_rate_percent: number;
  term_days: number;
  loans_required_to_unlock_next: number;
  is_active: boolean;
}

export interface Kyc {
  id: string;
  user_id: string;
  full_name: string;
  document_id: string;
  birth_date: string;
  state: string;
  city: string;
  address: string;
  whatsapp_number: string;
  extra_info: string | null;
  status: KycStatus;
  reviewer_id: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface UserPaymentMethod {
  id: string;
  user_id: string;
  bank: string;
  holder_name: string;
  document_id: string;
  phone: string;
  is_locked: boolean;
  created_at: string;
}

export interface Loan {
  id: string;
  public_id: string;
  user_id: string;
  level_id: string;
  level_number: number;
  principal_amount: number;
  return_rate_percent: number;
  return_amount: number;
  total_amount: number;
  term_days: number;
  status: LoanStatus;
  requested_at: string;
  approved_at: string | null;
  disbursed_at: string | null;
  due_at: string | null;
  paid_at: string | null;
  amount_paid: number;
  rejected_reason: string | null;
}

export interface LoanPayment {
  id: string;
  loan_id: string;
  user_id: string;
  bank: string;
  amount: number;
  reference_number: string;
  payment_date: string;
  receipt_url: string | null;
  status: PaymentStatus;
  rejection_reason: string | null;
  created_at: string;
}

export interface PlatformPaymentMethod {
  id: string;
  bank: string;
  phone: string;
  document_id: string;
  holder_name: string;
  instructions: string | null;
  is_active: boolean;
}

export interface WhatsappMessage {
  id: string;
  key: string;
  label: string;
  template: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface AdminAction {
  id: string;
  admin_id: string;
  action: string;
  target_table: string;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

// El cliente Supabase se usa sin genérico `Database<>` (ver lib/supabase.ts).
// Estos tipos se aplican manualmente con casts (`as Loan`, `as Kyc[]`, etc.)
// en cada hook/página. Reemplazar este archivo por la salida real de
// `supabase gen types typescript` una vez desplegada la base de datos.
