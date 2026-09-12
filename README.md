# LES PREST — "Tu préstamo seguro"

Plataforma de microcréditos progresivos, mobile-first, lista para convertirse en PWA.

## ⚠️ Nota importante sobre la tasa de retorno

Los niveles vienen precargados con una tasa de ejemplo de **6% a 10 días**
(rango realista de microfinanzas legales en la región), **no** con el 50%
originalmente solicitado. El porcentaje, el monto y el plazo de cada nivel
son 100% configurables desde `ADMIN → Niveles`, sin tocar código — pero el
valor que uses en producción es tu responsabilidad legal. Antes de operar
con dinero real en Venezuela, valida la tasa con la normativa de protección
al consumidor y usura aplicable.

## Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **PWA**: manifest.json + service worker (`public/sw.js`)

## 1. Crear el proyecto en Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, ejecuta en orden:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_functions.sql`
3. Ve a **Project Settings → API** y copia:
   - `Project URL`
   - `anon public key`

## 2. Configurar el frontend

```bash
cp .env.example .env
# Edita .env con tu Project URL y anon key
npm install
npm run dev
```

## 3. Crear tu primer usuario administrador

1. Entra a la app en `/registro` y crea una cuenta con el correo que usarás
   como admin.
2. En el **SQL Editor** de Supabase, edita y ejecuta
   `supabase/migrations/0003_promote_admin.sql` reemplazando el correo por
   el que usaste.
3. Vuelve a iniciar sesión: ahora entrarás directo a `/admin`.

## 4. Configurar métodos de pago y documentos legales

Antes de que un usuario pueda pagar una cuota, necesitas:

- `ADMIN → Métodos de pago`: crear el Pago Móvil oficial de LES PREST.
- Insertar al menos un documento de términos en la tabla `legal_documents`
  (`doc_type = 'terminos'`, `is_current = true`) — puedes hacerlo desde el
  SQL Editor o construir una pantalla de admin adicional para editarlo.

## 5. Build de producción

```bash
npm run build
```

Los archivos quedan en `dist/`. Puedes desplegar en Vercel, Netlify, Cloudflare
Pages, o cualquier hosting estático (recuerda servir `manifest.json` y `sw.js`
desde la raíz).

## Arquitectura de seguridad

- **RLS activo en todas las tablas.** Un usuario solo puede leer sus propios
  registros; los admins tienen políticas explícitas.
- **Toda mutación de negocio pasa por funciones `SECURITY DEFINER`**
  (`request_loan`, `admin_review_loan`, `admin_confirm_disbursement`,
  `submit_loan_payment`, `admin_review_payment`, `admin_review_kyc`). El
  cliente nunca hace `UPDATE` directo sobre nivel, monto, tasa, estado de
  préstamo o estado de pago.
- **Referencia bancaria única** vía `UNIQUE INDEX` parcial en
  `loan_payments`, reforzado también en la función `submit_loan_payment`.
- Las claves de Supabase en `.env` son la **anon key pública** (segura de
  exponer en frontend gracias a RLS). Nunca coloques la `service_role key`
  en el frontend.

## Estructura del proyecto

```
supabase/migrations/       Esquema SQL, funciones, seed, script de admin
src/lib/                   Cliente Supabase, tipos de dominio, formato, hooks
src/context/AuthContext    Sesión y perfil del usuario
src/components/            UI base, navegación inferior, layouts, rutas protegidas
src/pages/auth/            Registro y login
src/pages/app/             Dashboard, KYC, Pago Móvil, solicitud/pago de préstamo
src/pages/admin/           Panel administrativo completo
public/                    manifest.json, service worker, íconos PWA
```

## Pendiente para producción real

- Reemplazar `src/lib/database.types.ts` por la salida de
  `npx supabase gen types typescript --project-id TU_PROYECTO` una vez
  desplegada la base de datos, para recuperar tipado estricto en cada
  llamada a Supabase.
- Configurar `pg_cron` o una Edge Function programada que llame a
  `mark_overdue_loans()` diariamente.
- Subir comprobantes de pago a Supabase Storage y enlazar `receipt_url`.
- Revisar y completar la sección legal (`legal_documents`) con asesoría
  jurídica antes de operar con dinero real.
