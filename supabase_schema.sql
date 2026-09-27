-- ==============================================================================
-- SCHEMA COMPLETO Y ACTUALIZADO PARA PRESTAPP (SUPABASE POSTGRESQL)
-- ==============================================================================

-- 1. TABLA DE LISTA NEGRA (BLACK_LIST)
-- Registra cédulas, correos y números bloqueados por morosidad o impago.
CREATE TABLE IF NOT EXISTS public.black_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_card TEXT NOT NULL UNIQUE,       -- Cédula bloqueada (V-XXXXX)
    email TEXT,                         -- Correo electrónico bloqueado
    phone TEXT,                         -- Teléfono bloqueado
    reason TEXT DEFAULT 'Impago de crédito / Morosidad no solventada',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABLA DE PERFILES DE USUARIO (PROFILES)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    id_card TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    bank_name TEXT DEFAULT '0134 - Banesco Banco Universal',
    cedula_url TEXT,
    selfie_url TEXT,
    current_level INT DEFAULT 1,
    consecutive_paid_in_level INT DEFAULT 0, -- Debe pagar 2 veces para ascender de nivel
    kyc_status TEXT DEFAULT 'en_revision' CHECK (kyc_status IN ('no_verificado', 'en_revision', 'verificado', 'rechazado')),
    role TEXT DEFAULT 'cliente' CHECK (role IN ('cliente', 'admin')),
    is_blacklisted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABLA DE PRÉSTAMOS (LOANS)
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
    term_days INT DEFAULT 10,
    due_date TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aprobado', 'desembolsado', 'pagado', 'rechazado', 'moroso', 'vencido')),
    disbursement_ref TEXT,
    paid_on_time BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABLA DE PAGOS Y CONCILIACIONES PAGO MÓVIL (PAYMENTS)
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

-- 5. TABLA DE CONFIGURACIONES GLOBALES (APP_SETTINGS)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- VALORES POR DEFECTO PARA EL PRIMER NIVEL (1$ USD, 2 PAGOS PARA SUBIR)
INSERT INTO public.app_settings (key, value, description)
VALUES 
    ('bcv_rate', '54.25', 'Tasa oficial BCV en Bolívares por Dólar'),
    ('level1_max_amount', '1.00', 'Monto del primer nivel en USD ($1 USD)'),
    ('level1_rate_percent', '6.0', 'Porcentaje de interés para el nivel 1'),
    ('level1_installments', '1', 'Número de cuotas para el nivel 1'),
    ('level1_interval_days', '10', 'Cada cuántos días se paga el nivel 1'),
    ('payments_to_advance_level', '2', 'Cuántas veces debe pagar a tiempo para pasar de nivel'),
    ('telegram_bot_token', '', 'Token del Bot de Telegram'),
    ('telegram_chat_id_kyc', '', 'Chat ID para registro y fotos KYC'),
    ('telegram_chat_id_operations', '', 'Chat ID para operaciones y pagos'),
    ('app_download_url', '/prestapp.apk', 'Enlace directo de descarga APK')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- TABLA DE NOTIFICACIONES PUSH PARA USUARIOS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT DEFAULT 'general',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.black_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS DE ACCESO
CREATE POLICY "Blacklist read" ON public.black_list FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Blacklist admin" ON public.black_list FOR ALL USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Profiles read" ON public.profiles FOR SELECT USING (auth.uid() = id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Profiles insert" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Profiles update" ON public.profiles FOR UPDATE USING (auth.uid() = id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Loans access" ON public.loans FOR ALL USING (auth.uid() = user_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Payments access" ON public.payments FOR ALL USING (auth.uid() = user_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Notifications access" ON public.notifications FOR ALL USING (auth.uid() = user_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Settings read" ON public.app_settings FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Settings admin" ON public.app_settings FOR ALL USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
