-- ==============================================================================
-- SCHEMA COMPLETO DE BASE DE DATOS PARA PRESTAPP (SUPABASE POSTGRESQL)
-- Copia y pega todo este script en el SQL Editor de tu panel de Supabase
-- ==============================================================================

-- 1. TABLA DE PERFILES DE USUARIO (PROFILES)
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
    kyc_status TEXT DEFAULT 'en_revision' CHECK (kyc_status IN ('no_verificado', 'en_revision', 'verificado', 'rechazado')),
    role TEXT DEFAULT 'cliente' CHECK (role IN ('cliente', 'admin')),
    fcm_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABLA DE PRÉSTAMOS (LOANS)
CREATE TABLE IF NOT EXISTS public.loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount_usd NUMERIC(10, 2) NOT NULL,
    amount_ves NUMERIC(15, 2) NOT NULL,
    interest_usd NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_due_usd NUMERIC(10, 2) NOT NULL,
    total_due_ves NUMERIC(15, 2) NOT NULL,
    bcv_rate NUMERIC(10, 2) NOT NULL,
    term_days INT DEFAULT 10,
    due_date TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aprobado', 'desembolsado', 'pagado', 'rechazado', 'vencido')),
    disbursement_ref TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABLA DE PAGOS Y CONCILIACIONES PAGO MÓVIL (PAYMENTS)
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

-- 4. TABLA DE NOTICIAS Y ACTUALIZACIONES DE LA APP (APP_NEWS)
CREATE TABLE IF NOT EXISTS public.app_news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tag TEXT DEFAULT 'Actualización',
    is_important BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. TABLA DE NOTIFICACIONES PUSH PARA USUARIOS (NOTIFICATIONS)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT DEFAULT 'general' CHECK (type IN ('general', 'pago_aprobado', 'desembolso', 'noticia', 'kyc')),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. TABLA DE CONFIGURACIONES GLOBALES (APP_SETTINGS)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- INSERTS POR DEFECTO DE CONFIGURACIÓN
INSERT INTO public.app_settings (key, value, description)
VALUES 
    ('bcv_rate', '54.25', 'Tasa oficial BCV en Bolívares por Dólar'),
    ('telegram_bot_token', '', 'Token del Bot de Telegram (ej: 7123456789:AAH...)'),
    ('telegram_chat_id_kyc', '', 'Chat ID o Canal para registros y verificación KYC con fotos'),
    ('telegram_chat_id_operations', '', 'Chat ID o Canal para préstamos y pagos conciliados'),
    ('app_download_url', '/prestapp.apk', 'Enlace directo de descarga del APK Oficial de Android')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- INSERTS POR DEFECTO DE NOTICIAS DE LA APP
INSERT INTO public.app_news (title, content, tag, is_important)
VALUES 
    ('¡Bienvenido a PrestApp Oficial!', 'Ya puedes solicitar tus microcréditos directamente desde nuestra App Android con aprobación en minutos.', 'Lanzamiento', true),
    ('Notificaciones en Tiempo Real Activadas', 'Ahora recibirás avisos inmediatos en tu móvil cuando tu pago sea conciliado y cuando tu desembolso esté listo.', 'Mejora', false);

-- HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS DE SEGURIDAD (POLICIES)

-- Profiles
CREATE POLICY "Usuarios pueden ver su propio perfil o admin ver todos" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Usuarios pueden actualizar su propio perfil o admin" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Cualquiera autenticado puede insertar su perfil" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Loans
CREATE POLICY "Usuarios ven sus propios préstamos o admin ve todos" 
ON public.loans FOR SELECT 
USING (auth.uid() = user_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Usuarios insertan solicitudes de préstamos" 
ON public.loans FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin puede actualizar préstamos" 
ON public.loans FOR UPDATE 
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Payments
CREATE POLICY "Usuarios ven sus propios pagos o admin ve todos" 
ON public.payments FOR SELECT 
USING (auth.uid() = user_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Usuarios insertan referencias de pago" 
ON public.payments FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin puede actualizar pagos" 
ON public.payments FOR UPDATE 
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- App News (Público para lectura, Admin para escritura)
CREATE POLICY "Cualquiera puede leer noticias" 
ON public.app_news FOR SELECT 
TO PUBLIC USING (true);

CREATE POLICY "Admin puede crear noticias" 
ON public.app_news FOR INSERT 
WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admin puede actualizar o borrar noticias" 
ON public.app_news FOR ALL 
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Notifications
CREATE POLICY "Usuarios ven sus notificaciones" 
ON public.notifications FOR SELECT 
USING (auth.uid() = user_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admin o sistema inserta notificaciones" 
ON public.notifications FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Usuarios actualizan sus notificaciones" 
ON public.notifications FOR UPDATE 
USING (auth.uid() = user_id);

-- App Settings (Lectura para autenticados, Admin para escritura)
CREATE POLICY "Cualquiera autenticado lee configuraciones" 
ON public.app_settings FOR SELECT 
TO PUBLIC USING (true);

CREATE POLICY "Admin gestiona configuraciones" 
ON public.app_settings FOR ALL 
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
