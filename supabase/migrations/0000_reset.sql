-- =====================================================================
-- LES PREST — RESETEO COMPLETO
-- =====================================================================
-- Borra todas las tablas, funciones, triggers y tipos creados por el
-- proyecto, para poder volver a ejecutar 0001_schema.sql y
-- 0002_functions.sql desde cero, sin restos de una instalación anterior
-- a medio hacer.
-- NO borra tus usuarios de auth.users: eso se hace manualmente desde
-- Authentication -> Users en el dashboard de Supabase.
-- =====================================================================

drop trigger if exists on_auth_user_created on auth.users;

drop function if exists handle_new_user() cascade;
drop function if exists is_admin() cascade;
drop function if exists request_loan() cascade;
drop function if exists admin_review_loan(uuid, text, text) cascade;
drop function if exists admin_confirm_disbursement(uuid, numeric, text, text, date, time, text) cascade;
drop function if exists submit_loan_payment(uuid, text, numeric, text, date, text) cascade;
drop function if exists admin_review_payment(uuid, text, text) cascade;
drop function if exists mark_overdue_loans() cascade;
drop function if exists admin_review_kyc(uuid, text, text) cascade;

drop table if exists admin_actions cascade;
drop table if exists notifications cascade;
drop table if exists whatsapp_messages cascade;
drop table if exists terms_acceptance cascade;
drop table if exists legal_documents cascade;
drop table if exists loan_payments cascade;
drop table if exists platform_payment_methods cascade;
drop table if exists loan_disbursements cascade;
drop table if exists loans cascade;
drop table if exists loan_levels cascade;
drop table if exists user_payment_methods cascade;
drop table if exists kyc cascade;
drop table if exists settings cascade;
drop table if exists profiles cascade;

drop sequence if exists loan_public_id_seq;

drop type if exists app_role cascade;
drop type if exists kyc_status cascade;
drop type if exists loan_status cascade;
drop type if exists payment_status cascade;

-- Confirmación
select 'Reseteo completo. Ahora ejecuta 0001_schema.sql y luego 0002_functions.sql' as resultado;
