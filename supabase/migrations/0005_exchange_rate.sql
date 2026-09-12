-- =====================================================================
-- LES PREST — Tasa de cambio USD -> VES
-- =====================================================================
-- Se guarda en la tabla `settings` (clave/valor) que ya existía, para no
-- crear una tabla nueva. El admin la actualiza desde el panel cuando
-- cambie el precio del dólar; toda la app la lee en tiempo real.
-- =====================================================================

insert into settings (key, value)
values ('usd_to_ves_rate', '1'::jsonb)
on conflict (key) do nothing;
