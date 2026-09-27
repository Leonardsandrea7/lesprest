-- ==============================================================================
-- MIGRACIÓN V3 — Panel admin completo, niveles 1-6, 3 bots de Telegram, soporte
-- Ejecutar DESPUÉS de supabase_schema.sql y supabase_migration_v2.sql
-- Supabase Dashboard → SQL Editor → pegar todo → Run.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. AVISO DE SEGURIDAD IMPORTANTE
-- ------------------------------------------------------------------------------
-- La tabla "app_settings" original tenía política "FOR SELECT TO PUBLIC USING (true)"
-- y ahí se guardaba el token del bot de Telegram en texto plano. Eso significa que
-- CUALQUIERA con la anon key (que es pública, va en el bundle de la web) podía leer
-- tu bot token directo desde el navegador. Esta migración saca los tokens de esa
-- tabla y los mueve a "app_secrets" (solo admin puede leerla). Si tu bot ya estuvo
-- en producción con un token ahí guardado, es buena práctica ir a @BotFather en
-- Telegram y hacer /revoke a ese bot para invalidar el token viejo y generar uno nuevo.

DELETE FROM public.app_settings WHERE key LIKE 'telegram_%';

-- ------------------------------------------------------------------------------
-- 1. TABLA DE SECRETOS (solo admin puede leer/escribir) — los 3 bots de Telegram
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

ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Secrets admin only" ON public.app_secrets;
CREATE POLICY "Secrets admin only" ON public.app_secrets
  FOR ALL
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- ------------------------------------------------------------------------------
-- 2. DATOS DE PAGO MÓVIL DEL NEGOCIO (a dónde el cliente te transfiere)
-- Esto SÍ es público (el cliente necesita verlo para poder pagarte).
-- ------------------------------------------------------------------------------
INSERT INTO public.app_settings (key, value, description) VALUES
    ('payout_bank_name', '0134 - Banesco Banco Universal', 'Banco al que el cliente debe hacer el Pago Móvil'),
    ('payout_phone', '0414-0000000', 'Teléfono para recibir el Pago Móvil'),
    ('payout_id_card', 'V-00000000', 'Cédula/RIF asociada al Pago Móvil'),
    ('payout_holder_name', 'PrestApp C.A.', 'Nombre del titular de la cuenta')
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 3. NIVELES DE PRÉSTAMO (1 al 6) — cada uno con su propio monto, tasa, cuotas,
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

ALTER TABLE public.loan_levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Loan levels read" ON public.loan_levels;
CREATE POLICY "Loan levels read" ON public.loan_levels FOR SELECT TO PUBLIC USING (true);

DROP POLICY IF EXISTS "Loan levels admin write" ON public.loan_levels;
CREATE POLICY "Loan levels admin write" ON public.loan_levels
  FOR ALL
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Guarda cuántas cuotas se pactaron en cada préstamo ya desembolsado
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS installments INT DEFAULT 1;

-- ------------------------------------------------------------------------------
-- 4. CHAT DE SOPORTE (cliente ↔ Telegram ↔ admin, bidireccional)
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

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Support select own" ON public.support_messages;
CREATE POLICY "Support select own" ON public.support_messages
  FOR SELECT USING (auth.uid() = user_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Support insert own" ON public.support_messages;
CREATE POLICY "Support insert own" ON public.support_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Support update own or admin" ON public.support_messages;
CREATE POLICY "Support update own or admin" ON public.support_messages
  FOR UPDATE USING (auth.uid() = user_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- ------------------------------------------------------------------------------
-- 5. Permitir que el admin edite CUALQUIER perfil (nivel, kyc, rol, banco, etc.)
--    Ya estaba cubierto por la policy "Profiles update" del schema original
--    (auth.uid() = id OR role admin), así que no hace falta tocarla. Se deja
--    este comentario como referencia de que "editar todo el usuario" ya
--    funciona con el esquema base.
-- ==============================================================================
