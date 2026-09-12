-- =====================================================================
-- LES PREST — Promover un usuario a administrador
-- =====================================================================
-- Uso:
--   1) Crea la cuenta normalmente desde /registro con el correo del admin.
--   2) Ejecuta este script reemplazando el correo, en el SQL Editor de Supabase.
-- =====================================================================

update profiles
set role = 'admin'
where id = (select id from auth.users where email = 'admin@lesprest.com');

-- Verifica el resultado:
select p.id, u.email, p.role
from profiles p
join auth.users u on u.id = p.id
where u.email = 'admin@lesprest.com';
