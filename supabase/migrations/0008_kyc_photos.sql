-- =====================================================================
-- LES PREST — Fotos de KYC (cédula + selfie)
-- =====================================================================
-- Bucket PRIVADO: nadie puede ver las fotos por un link directo. Solo
-- el propio usuario (sus fotos) y los admins pueden acceder, y siempre
-- mediante una URL firmada que vence en minutos.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('kyc-documents', 'kyc-documents', false)
on conflict (id) do nothing;

create policy "usuario sube sus propios documentos kyc"
on storage.objects for insert
with check (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "usuario y admin ven documentos kyc"
on storage.objects for select
using (bucket_id = 'kyc-documents' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));

alter table kyc
  add column id_photo_path text,
  add column selfie_photo_path text;
