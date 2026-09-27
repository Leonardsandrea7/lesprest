# PrestApp — Guía de lanzamiento (v3, completa)

## 1. Correr las migraciones SQL (en orden)

En Supabase → **SQL Editor**, ejecuta en este orden (si ya corriste alguna en el pasado, no pasa nada, son seguras de repetir):

1. `supabase_schema.sql` (si es un proyecto nuevo de Supabase)
2. `supabase_migration_v2.sql` (bucket de fotos KYC)
3. `supabase_migration_v3.sql` (niveles 1-6, secretos de los bots, soporte, pago móvil)

La migración v3 **borra** cualquier token de Telegram que hubiera quedado guardado en `app_settings` (estaba expuesto públicamente por error del proyecto original). Si tu bot viejo ya estuvo en producción, ve a **@BotFather** en Telegram → `/mybots` → tu bot → **API Token** → **Revoke current token**, y genera uno nuevo para usarlo desde ahora.

## 2. Variables de entorno en Vercel

Ve a tu proyecto en Vercel → **Settings → Environment Variables** y agrega:

| Variable | De dónde sacarla |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → **service_role** (secreta, nunca la pongas con prefijo `VITE_`, y nunca la subas a un repo público) |
| `TELEGRAM_WEBHOOK_SECRET` | Invéntate un texto random largo, ej. `openssl rand -hex 24` |

Después de agregarlas, vuelve a desplegar (Redeploy) para que tomen efecto.

## 3. Crear tus 3 bots de Telegram

Necesitas **3 bots distintos** (puedes usar el mismo número de Telegram para administrar los 3):

1. Habla con **@BotFather** → `/newbot` → dale un nombre → te da un **token**. Repite esto 3 veces:
   - `PrestApp Operaciones` → préstamos y pagos
   - `PrestApp Registro/KYC` → nuevos registros y verificación
   - `PrestApp Soporte` → chat de soporte con tus clientes
2. Para cada bot, crea un grupo/canal en Telegram, agrega el bot como miembro, y averigua el **Chat ID**: la forma más simple es escribirle algo al bot/grupo y luego abrir `https://api.telegram.org/bot<TU_TOKEN>/getUpdates` en el navegador — ahí aparece `"chat":{"id": ...}`.
3. Entra a tu app como admin → **Configuración → Bots de Telegram** → pega los 3 tokens y sus 3 chat IDs → Guardar Bots.

## 4. Activar el webhook del bot de Soporte (para que tus respuestas en Telegram lleguen a la app)

Esto solo se hace **una vez**, desde tu computadora (con `curl` o Postman), reemplazando los valores:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN_DEL_BOT_DE_SOPORTE>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://TU-DOMINIO-EN-VERCEL.vercel.app/api/telegram-webhook",
    "secret_token": "EL_MISMO_VALOR_QUE_PUSISTE_EN_TELEGRAM_WEBHOOK_SECRET"
  }'
```

Cómo funciona después de esto: cuando un cliente escribe en **Soporte** dentro de la app, te llega el mensaje al chat de Telegram del bot de Soporte. Si tú le das **"Responder" (reply)** a ese mensaje específico de Telegram y escribes tu respuesta, esa respuesta aparece automáticamente en la app del cliente. Si escribes un mensaje suelto (sin usar "Responder"), el sistema no sabe a quién dirigirlo y se ignora — por eso siempre debes usar "Responder" sobre el mensaje del cliente.

## 5. Confirmar el APK

Debe estar en `public/prestapp.apk` para que el botón "Descargar APK" del Navbar funcione en producción.

## 6. Crear tu primer usuario admin

Regístrate normal desde `/register` (queda como `cliente`). Luego en Supabase → **Table Editor → profiles**, cambia el campo `role` de ese usuario a `admin`. La próxima vez que inicie sesión, entrará directo a la Consola de Admin y ya no verá nada de la interfaz de cliente (ni el Navbar, ni el Dashboard, ni el botón de descarga del APK) — quedan completamente separados.

## 7. Qué puede editar el admin ahora (todo, como pediste)

Desde `/admin`, por pestañas:
- **Usuarios**: nombre, teléfono, banco, nivel (1-6), estado de KYC, rol (cliente/admin), bloqueo — todo editable por usuario.
- **Préstamos y Pagos**: aprobar/rechazar solicitudes, conciliar pagos (a tiempo / tarde), lo cual sube de nivel automáticamente según lo que configures.
- **KYC**: ver cédula + selfie de cada cliente y verificar/rechazar.
- **Lista Negra**: bloquear/desbloquear por cédula.
- **Soporte**: ver todas las conversaciones (y responder desde la app si quieres, además de por Telegram).
- **Configuración**: tasa BCV, **niveles 1 al 6 completos** (monto, % de interés, cuotas, días de plazo, y cuántos pagos a tiempo se necesitan para subir de nivel — todo por nivel, no genérico), datos de tu Pago Móvil para que el cliente sepa a dónde pagarte, y los 3 bots de Telegram.

## 8. Sobre las notificaciones push

Las notificaciones push nativas (que llegan aunque el celular tenga la app cerrada) dependen de Firebase Cloud Messaging integrado directamente en el **APK Android**, que es un proyecto aparte de este código web — como mencionaste que la APK ya las trae, no hay nada que tocar ahí desde este repositorio web. Lo que sí construí en la web es el equivalente dentro de la app: la campanita de **Notificaciones** en el Dashboard del cliente (avisos de aprobación de préstamo, pago aprobado, KYC verificado, etc.), que se generan automáticamente cada vez que el admin hace esas acciones.

## 9. Modelo de negocio (para que quede explícito)

Este sistema sigue el modelo de "Pago Móvil manual": el cliente transfiere por su cuenta a tu número/banco (mostrado en pantalla) y luego reporta el número de referencia en la app; tú lo concilias manualmente desde Admin. No es una pasarela de pago automática (Stripe, PayPal, etc.) — si más adelante quieres eso, es un proyecto aparte con implicaciones legales/regulatorias en Venezuela que vale la pena evaluar con calma.
