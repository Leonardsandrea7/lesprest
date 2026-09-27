-- ==============================================================================
-- MIGRACIÓN V2 — Flujo real de cliente (solicitar préstamo / reportar pago)
-- + Storage privado para fotos de KYC (cédula y selfie)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → pegar y correr.
-- Es seguro correrlo aunque ya hayas corrido supabase_schema.sql antes.
-- ==============================================================================

-- 1. POLÍTICAS EXPLÍCITAS DE INSERCIÓN
-- El schema original ya permite esto de forma implícita (FOR ALL USING),
-- pero las dejamos explícitas para que quede 100% claro y no dependa de
-- comportamiento por defecto de Postgres entre versiones.
DROP POLICY IF EXISTS "Loans insert own" ON public.loans;
CREATE POLICY "Loans insert own" ON public.loans
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Payments insert own" ON public.payments;
CREATE POLICY "Payments insert own" ON public.payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2. BUCKET PRIVADO PARA FOTOS DE KYC (cédula + selfie)
-- Privado (public = false): las fotos de identidad NUNCA deben ser públicas.
-- El panel Admin las lee usando URLs firmadas (createSignedUrl), no URLs públicas.
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-photos', 'kyc-photos', false)
ON CONFLICT (id) DO NOTHING;

-- 3. POLÍTICAS DE STORAGE
-- Convención de rutas: cada archivo se guarda como "<user_id>/cedula-*.jpg" o
-- "<user_id>/selfie-*.jpg", así que el primer segmento de la ruta (foldername)
-- es siempre el uid del dueño.

-- 3a. El propio usuario puede subir SOLO dentro de su propia carpeta.
DROP POLICY IF EXISTS "kyc_upload_own_folder" ON storage.objects;
CREATE POLICY "kyc_upload_own_folder" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'kyc-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 3b. El propio usuario puede leer/actualizar/reemplazar solo sus propias fotos.
DROP POLICY IF EXISTS "kyc_read_own_folder" ON storage.objects;
CREATE POLICY "kyc_read_own_folder" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'kyc-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "kyc_update_own_folder" ON storage.objects;
CREATE POLICY "kyc_update_own_folder" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'kyc-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 3c. El admin puede leer TODAS las fotos (para revisar KYC desde el panel).
DROP POLICY IF EXISTS "kyc_admin_read_all" ON storage.objects;
CREATE POLICY "kyc_admin_read_all" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'kyc-photos'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- ==============================================================================
-- Con esto:
--   - Un cliente logueado puede insertar en "loans" y "payments" (su propio user_id).
--   - Un cliente puede subir su cédula/selfie a kyc-photos/<su_uid>/...
--   - El admin puede ver todas las fotos para verificar el KYC desde el panel.
-- ==============================================================================
