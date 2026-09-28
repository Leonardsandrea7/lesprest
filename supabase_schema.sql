-- ==============================================================================
-- PRESTAPP — SCHEMA COMPLETO Y ÚNICO (Supabase / PostgreSQL)
-- Ejecutar UNA sola vez, completo, en un proyecto de Supabase nuevo:
-- Dashboard → SQL Editor → New query → pegar TODO este archivo → Run.
-- No hace falta ningún otro script. Es seguro volver a correrlo si algo falla
-- a mitad de camino (usa IF NOT EXISTS / DROP POLICY IF EXISTS en todo).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. LISTA NEGRA
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.black_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_card TEXT NOT NULL UNIQUE,
    email TEXT,
    phone TEXT,
    reason TEXT DEFAULT 'Impago de crédito / Morosidad no solventada',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 2. PERFILES DE USUARIO
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    id_card TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    bank_name TEXT DEFAULT '0134 - Banesco Banco Universal',
    cedula_url TEXT,
    selfie_url TEXT,
    current_level INT DEFAULT 1 CHECK (current_level BETWEEN 1 AND 6),
    consecutive_paid_in_level INT DEFAULT 0,
    kyc_status TEXT DEFAULT 'en_revision' CHECK (kyc_status IN ('no_verificado', 'en_revision', 'verificado', 'rechazado')),
    role TEXT DEFAULT 'cliente' CHECK (role IN ('cliente', 'admin')),
    is_blacklisted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 3. PRÉSTAMOS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount_usd NUMERIC(10, 2) NOT NULL,
    amount_ves NUMERIC(15, 2) NOT NULL,
    interest_usd NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_due_usd NUMERIC(10, 2) NOT NULL,
    total_due_ves NUMERIC(15, 2) NOT NULL,
    bcv_rate NUMERIC(10, 2) NOT NULL,
    level_borrowed INT DEFAULT 1,
    installments INT DEFAULT 1,
    term_days INT DEFAULT 10,
    due_date TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aprobado', 'desembolsado', 'pagado', 'rechazado', 'moroso', 'vencido')),
    disbursement_ref TEXT,
    paid_on_time BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 4. PAGOS (CONCILIACIÓN DE PAGO MÓVIL)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    loan_id UUID REFERENCES public.loans(id) ON DELETE SET NULL,
    reference TEXT NOT NULL,
    amount_usd NUMERIC(10, 2) NOT NULL,
    amount_ves NUMERIC(15, 2) NOT NULL,
    bcv_rate NUMERIC(10, 2) NOT NULL,
    status TEXT DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aprobado', 'rechazado')),
    receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 5. CONFIGURACIÓN PÚBLICA (tasa BCV y datos de Pago Móvil del negocio)
--    Esta tabla es de lectura pública a propósito: el cliente necesita ver
--    a dónde pagarte. NUNCA se guardan aquí tokens ni datos sensibles.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO public.app_settings (key, value, description) VALUES
    ('bcv_rate', '54.25', 'Tasa oficial BCV en Bolívares por Dólar'),
    ('payout_bank_name', '0134 - Banesco Banco Universal', 'Banco al que el cliente debe hacer el Pago Móvil'),
    ('payout_phone', '0414-0000000', 'Teléfono para recibir el Pago Móvil'),
    ('payout_id_card', 'V-00000000', 'Cédula/RIF asociada al Pago Móvil'),
    ('payout_holder_name', 'PrestApp C.A.', 'Nombre del titular de la cuenta')
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 6. SECRETOS (solo el admin puede leer/escribir) — los 3 bots de Telegram.
--    Separados de app_settings a propósito: nunca deben ser públicos.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_secrets (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '',
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO public.app_secrets (key, value, description) VALUES
    ('telegram_ops_bot_token', '', 'Bot que recibe solicitudes de préstamo y pagos reportados'),
    ('telegram_ops_chat_id', '', 'Chat/canal donde llegan préstamos y pagos'),
    ('telegram_kyc_bot_token', '', 'Bot que avisa nuevos registros con datos y fotos de KYC'),
    ('telegram_kyc_chat_id', '', 'Chat/canal donde llegan los registros para aprobar KYC'),
    ('telegram_support_bot_token', '', 'Bot de soporte: mensajes del cliente llegan aquí y tus respuestas (por Telegram) se reflejan en la app'),
    ('telegram_support_chat_id', '', 'Chat/canal donde llegan los mensajes de soporte')
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 7. NIVELES DE PRÉSTAMO (1 al 6) — cada uno con su propio monto, tasa, cuotas,
--    plazo y cuántos pagos a tiempo se necesitan para subir al siguiente nivel.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loan_levels (
    level INT PRIMARY KEY CHECK (level BETWEEN 1 AND 6),
    max_amount_usd NUMERIC(10, 2) NOT NULL,
    rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 6,
    installments INT NOT NULL DEFAULT 1,
    interval_days INT NOT NULL DEFAULT 10,
    payments_to_advance INT NOT NULL DEFAULT 2,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Valores iniciales de ejemplo — edítalos desde Admin → Configuración → Niveles
INSERT INTO public.loan_levels (level, max_amount_usd, rate_percent, installments, interval_days, payments_to_advance) VALUES
    (1, 1,   6, 1, 10, 2),
    (2, 5,   6, 1, 10, 2),
    (3, 15,  5, 1, 15, 2),
    (4, 30,  5, 2, 15, 2),
    (5, 60,  4, 2, 20, 2),
    (6, 100, 4, 3, 20, 2)
ON CONFLICT (level) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 8. NOTIFICACIONES INTERNAS (la campanita dentro de la app)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT DEFAULT 'general',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 9. CHAT DE SOPORTE (cliente ↔ Telegram ↔ admin, bidireccional)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('cliente', 'admin')),
    body TEXT NOT NULL,
    telegram_message_id BIGINT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 10. FUNCIÓN AUXILIAR PARA EVITAR RECURSIÓN EN RLS
-- Las políticas de abajo necesitan saber "¿este usuario es admin?" y para eso
-- consultarían la propia tabla profiles — pero como profiles TAMBIÉN tiene RLS,
-- eso puede generar "infinite recursion detected in policy for relation profiles"
-- y tumbar CUALQUIER consulta a profiles (logins, registros, todo). Esta función
-- es SECURITY DEFINER: corre saltándose el RLS solo para esta comprobación puntual,
-- rompiendo el ciclo. Es el patrón oficial recomendado por Supabase para esto.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ------------------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY
-- ------------------------------------------------------------------------------
ALTER TABLE public.black_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Blacklist read" ON public.black_list;
CREATE POLICY "Blacklist read" ON public.black_list FOR SELECT TO PUBLIC USING (true);
DROP POLICY IF EXISTS "Blacklist admin" ON public.black_list;
CREATE POLICY "Blacklist admin" ON public.black_list FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Profiles read" ON public.profiles;
CREATE POLICY "Profiles read" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.is_admin());
DROP POLICY IF EXISTS "Profiles insert" ON public.profiles;
CREATE POLICY "Profiles insert" ON public.profiles FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Profiles update" ON public.profiles;
CREATE POLICY "Profiles update" ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Loans access" ON public.loans;
CREATE POLICY "Loans access" ON public.loans FOR ALL USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Payments access" ON public.payments;
CREATE POLICY "Payments access" ON public.payments FOR ALL USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Notifications access" ON public.notifications;
CREATE POLICY "Notifications access" ON public.notifications FOR ALL USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Settings read" ON public.app_settings;
CREATE POLICY "Settings read" ON public.app_settings FOR SELECT TO PUBLIC USING (true);
DROP POLICY IF EXISTS "Settings admin" ON public.app_settings;
CREATE POLICY "Settings admin" ON public.app_settings FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Secrets admin only" ON public.app_secrets;
CREATE POLICY "Secrets admin only" ON public.app_secrets FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Loan levels read" ON public.loan_levels;
CREATE POLICY "Loan levels read" ON public.loan_levels FOR SELECT TO PUBLIC USING (true);
DROP POLICY IF EXISTS "Loan levels admin write" ON public.loan_levels;
CREATE POLICY "Loan levels admin write" ON public.loan_levels FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Support select" ON public.support_messages;
CREATE POLICY "Support select" ON public.support_messages FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "Support insert" ON public.support_messages;
CREATE POLICY "Support insert" ON public.support_messages FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "Support update" ON public.support_messages;
CREATE POLICY "Support update" ON public.support_messages FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 12. STORAGE: bucket privado para fotos de KYC (cédula + selfie)
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-photos', 'kyc-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "kyc_upload_own_folder" ON storage.objects;
CREATE POLICY "kyc_upload_own_folder" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'kyc-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "kyc_read_own_folder" ON storage.objects;
CREATE POLICY "kyc_read_own_folder" ON storage.objects FOR SELECT
  USING (bucket_id = 'kyc-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "kyc_update_own_folder" ON storage.objects;
CREATE POLICY "kyc_update_own_folder" ON storage.objects FOR UPDATE
  USING (bucket_id = 'kyc-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "kyc_admin_read_all" ON storage.objects;
CREATE POLICY "kyc_admin_read_all" ON storage.objects FOR SELECT
  USING (bucket_id = 'kyc-photos' AND public.is_admin());

-- ==============================================================================
-- LISTO. Con esto solo, tu proyecto de Supabase queda 100% preparado.
-- Siguiente paso: crea tu primer usuario en /register y luego, en
-- Table Editor → profiles, cámbiale el "role" a "admin".
-- ==============================================================================
