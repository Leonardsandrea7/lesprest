-- =====================================================================
-- LES PREST — Corrección: eliminar versiones viejas de las funciones
-- que quedaron duplicadas al agregar el sistema de cuotas
-- =====================================================================
-- "create or replace function" en PostgreSQL solo reemplaza una función
-- si los parámetros son EXACTAMENTE los mismos. Como cambiamos los
-- parámetros de request_loan() y submit_loan_payment(), Postgres creó
-- una segunda versión en vez de reemplazar la original, dejando dos
-- funciones con el mismo nombre (esto se llama "overloading") y
-- causando el error "Could not choose the best candidate function".
-- =====================================================================

drop function if exists request_loan();
drop function if exists submit_loan_payment(uuid, text, numeric, text, date, text);

-- Confirmación
select 'Funciones duplicadas eliminadas correctamente' as resultado;
