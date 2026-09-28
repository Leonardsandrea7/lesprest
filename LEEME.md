# PrestApp — Guía de lanzamiento desde cero

Sigue estos pasos en orden. Es todo lo que hace falta.

## 1. Crear el proyecto de Supabase

1. Crea un proyecto nuevo en [supabase.com](https://supabase.com).
2. Ve a **SQL Editor → New query**, pega **todo** el contenido de `supabase_schema.sql` (un solo archivo, no hay más) y dale **Run**.
3. Ve a **Settings → API** y anota estos 3 valores, los vas a necesitar en el paso 3:
   - **Project URL**
   - **anon public key**
   - **service_role key** (la secreta, más abajo)

## 2. Subir el proyecto a un repositorio y desplegarlo en Vercel

1. Sube esta carpeta a un repositorio nuevo (GitHub, GitLab, etc.).
2. En [vercel.com](https://vercel.com) → **Add New Project** → importa ese repositorio.
3. Antes de desplegar, sigue al paso 3 para poner las variables de entorno (si ya desplegaste sin ellas, no pasa nada, las agregas y le das **Redeploy**).

## 3. Variables de entorno en Vercel

En tu proyecto de Vercel → **Settings → Environment Variables**, agrega estas 4:

| Variable | Valor |
|---|---|
| `VITE_SUPABASE_URL` | El **Project URL** que anotaste en el paso 1 |
| `VITE_SUPABASE_ANON_KEY` | La **anon public key** del paso 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | La **service_role key** del paso 1 (nunca la compartas, nunca la pongas con prefijo `VITE_`) |
| `TELEGRAM_WEBHOOK_SECRET` | Inventa un texto largo random (ej. `openssl rand -hex 24` en tu terminal, o cualquier frase larga sin espacios) |

Después de agregarlas: **Deployments → los 3 puntitos del último deploy → Redeploy**.

## 4. Crear tu primer usuario administrador

1. Abre tu app ya desplegada → `/register` → regístrate normal como si fueras un cliente.
2. En Supabase → **Table Editor → profiles**, busca tu fila y cambia la columna `role` de `cliente` a `admin`.
3. Vuelve a iniciar sesión: ahora entras directo a la Consola de Admin, y ya no ves nada de la interfaz del cliente (quedan completamente separadas).

## 5. Configurar tus 3 bots de Telegram (opcional pero recomendado)

1. Habla con **@BotFather** en Telegram → `/newbot` → repite 3 veces para tener 3 bots:
   - Operaciones (préstamos y pagos)
   - Registro/KYC
   - Soporte
2. Para cada uno, crea un grupo, agrégalo, escríbele algo, y abre en tu navegador `https://api.telegram.org/bot<TU_TOKEN>/getUpdates` para ver el `chat.id`.
3. En tu app → `/admin` → **Configuración → Bots de Telegram**, pega los 3 tokens y sus 3 chat IDs → Guardar.
4. Para que tus respuestas en Telegram del bot de Soporte lleguen a la app, activa el webhook **una sola vez** desde tu computadora:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN_DEL_BOT_DE_SOPORTE>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://TU-DOMINIO.vercel.app/api/telegram-webhook",
    "secret_token": "EL_MISMO_VALOR_DE_TELEGRAM_WEBHOOK_SECRET"
  }'
```

Después de esto: cuando un cliente escribe en **Soporte**, te llega a Telegram. Si le das **"Responder"** (reply) a ese mensaje puntual y escribes, tu respuesta aparece en la app del cliente automáticamente. Un mensaje suelto (sin "Responder") no se puede vincular a nadie y se ignora — siempre usa "Responder".

## 6. Sobre el botón de "obtener la app"

Ya no hay varios botones ni enlaces rotos. Ahora hay **un solo componente** (`GetAppButton`) que se usa tanto en el Navbar como en la portada, y decide solo qué mostrar:

1. Si el navegador (Android/Chrome) permite instalar la PWA, el botón dice **"Instalar App"** y la instala de verdad, ahí mismo, sin descargar ningún archivo — esto funciona siempre que tu web esté en HTTPS (Vercel ya lo da) y cumpla los requisitos de PWA (ya los cumple).
2. Si además pones un `.apk` real en `public/prestapp.apk` (ver siguiente sección), el botón detecta que existe de verdad y dice **"Descargar APK"**.
3. Si ninguna de las dos aplica todavía, muestra instrucciones para instalarla manualmente desde el menú de Chrome — nunca un botón que no hace nada.

Antes, el botón apuntaba siempre a `/prestapp.apk` así el archivo no existiera; como Vercel no encontraba ese archivo, terminaba sirviendo el `index.html` de la propia web (por eso "descargaba un html"). Ya no puede volver a pasar.

## 7. Si quieres el .apk real además de la instalación como PWA

Coloca el archivo en `public/prestapp.apk` (ese nombre exacto) **antes de subir el repo**. El botón lo detecta automáticamente y empieza a ofrecer la descarga real. Si no tienes ese archivo todavía, no hace falta — la opción de "Instalar App" (PWA) ya deja a tus clientes con un ícono real en su pantalla de inicio, funcionando hoy mismo.

Si además quieres generar ese `.apk` a partir de esta misma web: ve a **pwabuilder.com**, pega tu URL de Vercel, elige Android, y te da un `.apk`/`.aab` real y firmado — lo bajas y lo pones en `public/prestapp.apk`.

## 8. Qué puede hacer cada quien

**Cliente**: Dashboard (ver préstamo activo/pendiente, solicitar según su nivel 1-6, ver a dónde pagar por Pago Móvil, reportar el pago), Perfil (editar sus datos), Soporte (chat con Telegram).

**Admin**, desde `/admin`, por pestañas:
- **Usuarios**: editar nombre, teléfono, banco, nivel, KYC, rol, bloqueo — todo, por usuario.
- **Préstamos y Pagos**: aprobar/rechazar solicitudes, conciliar pagos (a tiempo / tarde) — esto sube de nivel automáticamente.
- **KYC**: ver cédula + selfie de cada cliente, verificar o rechazar.
- **Lista Negra**: bloquear/desbloquear por cédula.
- **Soporte**: ver conversaciones (y responder desde ahí o desde Telegram).
- **Configuración**: tasa BCV, los 6 niveles completos (monto, %, cuotas, días, pagos para subir — cada uno independiente), datos de tu Pago Móvil, y los 3 bots de Telegram.

## 9. Cosas importantes que debes saber

- **Tus datos NO viven en el navegador.** Todo (usuarios, préstamos, pagos, KYC, chat) está en la base de datos de Supabase. Lo único que el navegador guarda localmente es el token de tu sesión iniciada, igual que cualquier web con login.
- **Modelo de pago**: es Pago Móvil manual — el cliente te transfiere directo y reporta el número de referencia; tú lo concilias desde Admin. No es una pasarela automática tipo Stripe.
- **Notificaciones push nativas** (con el celular cerrado) dependen del APK Android en sí (Firebase), que es un proyecto aparte de este código web. Lo que sí trae la web es la campanita de notificaciones dentro de la app.
- Si algo se queda cargando o da un error, ahora te lo va a decir explícitamente en pantalla (con botón de Reintentar) en vez de quedarse trabado — si eso pasa, revisa primero que las 4 variables de entorno del paso 3 estén bien puestas en Vercel.
