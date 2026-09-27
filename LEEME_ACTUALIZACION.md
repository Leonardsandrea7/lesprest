# PrestApp — Actualización: flujo real de cliente

## Qué se agregó

1. **Panel de cliente funcional** (`src/pages/ClientPanel.tsx`), ahora sirve la ruta `/dashboard` cuando hay sesión iniciada:
   - Ve su nivel, estado de KYC y si está bloqueado.
   - Si su KYC está `verificado` y no tiene préstamo activo → puede **solicitar un préstamo** (monto calculado según su nivel y la configuración del Admin).
   - Si tiene un préstamo `aprobado`/`desembolsado` → puede **reportar su pago móvil** (número de referencia).
   - Ve su **historial** de préstamos y pagos, y sus **notificaciones**.
   - `/` (la landing pública con el botón de descargar el APK) queda igual, sin tocar.

2. **Fotos de KYC ahora se guardan de verdad** (`src/lib/storage.ts`):
   - Antes: la foto solo se enviaba por Telegram; si el bot no estaba configurado, se perdía para siempre.
   - Ahora: se sube al bucket privado `kyc-photos` de Supabase Storage (carpeta por usuario) y la URL firmada queda guardada en `profiles.cedula_url` / `profiles.selfie_url`. Telegram sigue funcionando igual, como notificación adicional.

3. **Verificación de KYC en el Admin** (nueva sección "Clientes y Verificación de KYC" en `src/pages/Admin.tsx`):
   - Lista todos los clientes con sus dos fotos (clic para ampliar).
   - Botones **Verificar** / **Rechazar** que cambian `kyc_status` y notifican al cliente. Antes esto no existía en ningún lado de la UI.

4. **Navbar**: agregado el botón "Mi Cuenta" (visible solo si hay sesión) que lleva directo a `/dashboard`.

5. **Fase 0**: agregado `src/vite-env.d.ts` (elimina el warning de TypeScript de `import.meta.env`).

## Pasos para ponerlo en marcha

### 1. Correr la migración SQL nueva
Entra a tu proyecto de Supabase → **SQL Editor** → pega y ejecuta el contenido de `supabase_migration_v2.sql`. Es seguro correrla aunque ya tengas la base de datos con `supabase_schema.sql` aplicado antes; no borra nada, solo agrega el bucket de Storage y deja explícitas las políticas de inserción.

### 2. Verificar el APK
Como ya la subiste al repo, solo confirma que quede exactamente en `public/prestapp.apk` (con ese nombre y en esa carpeta) para que el link `/prestapp.apk` del botón de descarga funcione en producción.

### 3. Variables de entorno en Vercel
El `.env` local ya trae tu URL y anon key de Supabase, pero en Vercel debes configurarlas también en **Project Settings → Environment Variables**:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 4. Configurar Telegram (opcional pero recomendado)
Desde `/admin` → sección "Canales de Telegram", pega el token del bot y los Chat IDs. Ya no es obligatorio para no perder las fotos (ahora quedan en Storage de todas formas), pero sigue siendo útil para que te avisen al instante de cada registro/pago.

### 5. Crear tu primer usuario admin
El registro normal siempre crea `role: 'cliente'`. Para tener un admin, regístrate normal desde `/register` y luego, en Supabase → Table Editor → `profiles`, cambia manualmente el campo `role` de ese usuario a `admin`.

## Limitación conocida (para que la tengas presente)

El cálculo de montos para Nivel 2, 3, etc. **no está definido en tu negocio todavía** — en el Admin solo existen parámetros para el Nivel 1 ($1 USD, 6%, etc.). Mientras no definas montos/tasas propios por nivel, el sistema usa una regla simple: **duplica el monto del Nivel 1 por cada nivel alcanzado**, manteniendo el mismo % de interés y plazo (ver comentario en `src/lib/appData.ts`, función `calcLoanForLevel`). Cuando definas tu tabla real de niveles, dímelo y agrego una tabla `loan_levels` en Supabase + su formulario en el Admin para que cada nivel tenga su propio monto/tasa/plazo configurable.
