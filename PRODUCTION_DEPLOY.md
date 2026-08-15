# Deploy en producción

**Este documento empieza donde `CLIENT_SETUP.md` termina.**
Úsalo cuando el código ya está configurado para el cliente y hay que subirlo a producción.

**Stack:** OVHcloud VPS · Coolify · Cloudflare R2 · Stripe · Resend · PostgreSQL 16 · Redis 7
· Sentry · Better Stack

**VPS de referencia:** OVH **VPS-2** — 4 vCore / 8 GB RAM / 75 GB NVMe / 1 Gbit/s sin
límite, Ubuntu 24.04 LTS, datacenter de **Estrasburgo (Francia)**.
Los 8 GB no son por tráfico sino por el despliegue: Coolify compila en el propio
servidor y la compilación pide ~3 GB extra. Justificación completa y alternativas en
[`ROADMAP_PRODUCCION.md` § Fase 5](./ROADMAP_PRODUCCION.md#fase-5--infraestructura-un-vps-por-cliente).

---

## 1. Preparación del código

✅ **`medusa/Dockerfile` y `storefront/Dockerfile` ya existen en el repo base**, junto a
sus `.dockerignore`. Son idénticos para todos los clientes: no hay que tocarlos ni
copiarlos de aquí. Ambos usan Node 22 sobre Debian slim, compilan en una etapa aparte y
arrancan como usuario sin privilegios.

Dos cosas que conviene saber antes de configurar Coolify:

- **El storefront usa la salida `standalone` de Next** (`output: "standalone"` en
  `next.config.js`). La imagen final lleva solo las dependencias que el build rastrea
  como necesarias, no los `node_modules` enteros.
- **El backend fija `NODE_ENV=production` en la propia imagen.** Aun así, defínela
  también en Coolify: de ella depende que `medusa-config.js` rechace arrancar con
  secretos de firma débiles, y conviene que sea explícita.

- [ ] **En Coolify, marcar todas las `NEXT_PUBLIC_*` como Build Args** del storefront,
  además de como variables de entorno. Se incrustan en el JavaScript que descarga el
  navegador, así que tienen que existir **al compilar**: si solo se pasan en runtime, la
  tienda queda apuntando a `undefined`. La lista completa está en los `ARG` del
  `storefront/Dockerfile`.

- [ ] **Desplegar el backend antes que el storefront. No es una recomendación: sin
  Medusa respondiendo, el build del storefront FALLA.** No se degrada — sale con error.
  La página `/_not-found` renderiza el `Header`, el `Header` pide las regiones a la API,
  y `generateStaticParams` se ejecuta al compilar. Next reintenta 3 veces y aborta:

  ```
  Error occurred prerendering page "/_not-found"
  Export encountered an error on /_not-found/page, exiting the build.
  ```

  Verificado ejecutándolo: con el backend caído, `yarn build` sale con código 1.
  Consecuencia práctica en Coolify: **no redespliegues el storefront mientras Medusa
  esté reiniciándose**, o el despliegue muere. Comprueba antes que
  `https://api.tudominio.com/health` responde.

- [ ] En `storefront/next.config.js`, añadir en `remotePatterns` **el hostname desde el
  que se sirven las imágenes al navegador**, que no siempre es el de R2. Depende de lo
  que hayas elegido en el paso 4:

  **Con dominio propio (lo recomendado en §4):**

  ```js
  {
    protocol: "https",
    hostname: "media.tudominio.com",
  },
  ```

  **Con la URL de R2 directa:**

  ```js
  {
    protocol: "https",
    hostname: "*.r2.cloudflarestorage.com",
  },
  ```

  ⚠️ Es el error fácil: configurar el dominio propio en R2 y dejar aquí el patrón de
  `*.r2.cloudflarestorage.com`. Next rechaza el hostname y **las fotos de producto no
  cargan**, aunque estén perfectamente subidas. El valor de aquí tiene que coincidir con
  el host de `S3_FILE_URL`.

- [ ] Verificar que `storefront/next.config.js` **no tiene** `hostname: "localhost"` comentado sin el bloque de producción activo

- [ ] Commit y push a `master`

---

## 2. Coolify — setup inicial

- [ ] Instalar Coolify en el VPS ([docs.coolify.io/installation](https://docs.coolify.io/installation))
- [ ] Conectar el repositorio Git desde Coolify UI (GitHub/GitLab)
- [ ] Crear un proyecto en Coolify para este cliente
- [ ] Añadir servicio **PostgreSQL 16** (built-in) → guardar la `DATABASE_URL` generada
- [ ] Añadir servicio **Redis 7** (built-in) → guardar la `REDIS_URL` generada
- [ ] Añadir aplicación **medusa-backend**:
  - Source: repo Git, rama `master`
  - Subdirectory: `medusa`
  - Dockerfile: `medusa/Dockerfile`
  - Port: `9000`
  - Dominio: `https://api.tudominio.com`
  - **Release Command:** `./node_modules/.bin/medusa db:migrate`

  > ⚠️ **Se llama al binario por su ruta, no `yarn medusa db:migrate`.** La imagen de
  > producción no habilita corepack a propósito (ver el comentario del `Dockerfile`), así
  > que ahí `yarn` sería el yarn 1 global de la imagen y no el 4.7.0 del proyecto.
  > Funciona de rebote, pero depende de un detalle de la imagen base que puede cambiar.
  > La ruta directa no depende de nada.
- [ ] Añadir aplicación **storefront**:
  - Source: repo Git, rama `master`
  - Subdirectory: `storefront`
  - Dockerfile: `storefront/Dockerfile`
  - Port: `8000`
  - Dominio: `https://tienda.tudominio.com`
  - Build Args: activar (los `NEXT_PUBLIC_*` deben estar en Build Variables, no solo en Runtime)

---

## 3. Variables de entorno en Coolify UI

### Backend — `medusa-backend`

```env
# ⚠️ OBLIGATORIA Y FÁCIL DE OLVIDAR. El CLI de Medusa asume "development" si no
# está definida, y de ella depende que se activen las comprobaciones de
# seguridad de medusa-config.js (ver JWT_SECRET más abajo).
NODE_ENV=production

# Generadas por Coolify al crear los servicios
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Dominio
BACKEND_URL=https://api.tudominio.com
STOREFRONT_URL=https://tienda.tudominio.com

# CORS
STORE_CORS=https://tienda.tudominio.com
ADMIN_CORS=https://api.tudominio.com
AUTH_CORS=https://api.tudominio.com

# Secrets — generar uno DISTINTO para cada una con: openssl rand -hex 32
# Con NODE_ENV=production el backend se niega a arrancar si falta alguna, si
# vale "supersecret" o si tiene menos de 32 caracteres.
JWT_SECRET=
COOKIE_SECRET=

# Marca — cubre TODOS los emails (asuntos, cuerpo, cabecera y pie)
STORE_NAME=Mi Tienda

# Stripe
STRIPE_API_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cloudflare R2
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=<nombre-del-bucket>
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_FILE_URL=https://<dominio-publico-r2>/<nombre-del-bucket>
S3_FORCE_PATH_STYLE=true

# Resend
RESEND_API_KEY=re_...
RESEND_FROM=Mi Tienda <noreply@tudominio.com>
# Buzón real del cliente: adonde van las respuestas a los emails automáticos
EMAIL_REPLY_TO=contact@tudominio.com

# ⚠️ Sin esta variable NO se envía el aviso de venta al comerciante, y es la
# única señal automática de que hay un pedido que preparar.
MERCHANT_NOTIFICATION_EMAIL=

# Sentry — proyecto del BACKEND (distinto del storefront)
SENTRY_DSN=
```

### Storefront — `storefront`
*(marcar también como Build Args los `NEXT_PUBLIC_*`)*

```env
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://api.tudominio.com
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_...        ← del paso 6
NEXT_PUBLIC_BASE_URL=https://tienda.tudominio.com
NEXT_PUBLIC_DEFAULT_REGION=fr
NEXT_PUBLIC_STRIPE_KEY=pk_live_...               ← obligatorio, el build falla sin esto
REVALIDATE_SECRET=                               ← openssl rand -hex 32
NEXT_PUBLIC_INSTAGRAM_URL=https://instagram.com/tutienda
DISALLOW_ROBOTS=                                 ← dejar vacío en producción
NEXT_PUBLIC_SENTRY_DSN=                          ← proyecto del STOREFRONT, no el del backend
```

---

## 4. Cloudflare R2

- [ ] Crear bucket (ej: `mi-tienda-media`)
- [ ] En el bucket → Settings → CORS Policy, añadir:

```json
[
  {
    "AllowedOrigins": ["https://api.tudominio.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"]
  }
]
```

- [ ] Activar acceso público: R2 bucket → Settings → Public Access → Allow
  o configurar custom domain (ej: `media.tudominio.com`)
- [ ] Crear API Token con permisos `Object Read & Write` sobre el bucket
- [ ] Copiar `Account ID`, `Access Key ID`, `Secret Access Key` a las env vars del paso 3

---

## 5. Stripe

- [ ] En Stripe Dashboard, cambiar de modo Test a **Live**
- [ ] Copiar `sk_live_...` y `pk_live_...` a las env vars del paso 3
- [ ] Crear webhook en Stripe → Developers → Webhooks:
  - URL: `https://api.tudominio.com/hooks/payment/stripe`
  - Eventos — los tres son necesarios:
    - `payment_intent.succeeded` → el cobro se ha capturado
    - `payment_intent.amount_capturable_updated` → **el pago queda autorizado**
    - `payment_intent.payment_failed` → el cobro ha fallado

  > El de en medio es el que se olvida. El proveedor de Stripe de Medusa lo traduce a
  > `PaymentActions.AUTHORIZED` (verificado en `stripe-base.js`): sin él, los pagos
  > autorizados pero aún no capturados no llegan nunca a Medusa y el pedido se queda
  > colgado. El provider entiende además `canceled`, `created`, `partially_funded`,
  > `processing` y `requires_action`; regístralos si activas 3DS con reintentos o métodos
  > de pago diferidos.
- [ ] Copiar `whsec_...` a `STRIPE_WEBHOOK_SECRET` en Coolify

---

## 6. Resend

- [ ] En Resend → Domains, añadir y verificar el dominio del cliente
- [ ] Configurar los registros DNS (SPF, DKIM, DMARC) que indica Resend
- [ ] Crear API key → copiarla a `RESEND_API_KEY` en Coolify
- [ ] Enviar email de prueba desde la UI de Resend para confirmar que el dominio está verificado

---

## 7. Primer deploy

Lanzar en este orden desde Coolify UI:

- [ ] Deploy **PostgreSQL** → verificar que está `Running`
- [ ] Deploy **Redis** → verificar que está `Running`
- [ ] Deploy **medusa-backend** → verificar que el Release Command
  (`./node_modules/.bin/medusa db:migrate`, ver §2) corrió sin errores.
  **Las migraciones se lanzan ahí y solo ahí**: el `CMD` del Dockerfile no las ejecuta a
  propósito, porque son irreversibles y no deben dispararse en cada reinicio o escalado
  del contenedor
- [ ] Crear el usuario admin, una sola vez (terminal de Coolify o SSH al VPS):

```bash
cd /app
./node_modules/.bin/medusa user -e "admin@tudominio.com" -p "password-seguro"
```

  *(Ruta directa al binario por el mismo motivo que el Release Command: en la imagen de
  producción `yarn` no es el del proyecto.)*

- [ ] Ir a `https://api.tudominio.com/app/settings/publishable-api-keys`
  → copiar la clave publicable
  → pegarla en `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` en Coolify (storefront)
- [ ] Deploy **storefront** → verificar que el build termina sin errores

---

## 8. SEO final

- [ ] `https://tienda.tudominio.com/robots.txt` → confirmar que **no** contiene `Disallow: /`
- [ ] `https://tienda.tudominio.com/sitemap.xml` → confirmar que lista URLs de productos y colecciones
- [ ] Verificar canonical URL en el `<head>` de una página de producto
- [ ] Enviar sitemap a Google Search Console

---

## 9. Verificación post-deploy

- [ ] `https://api.tudominio.com/health` → responde `{ "status": "ok" }`
- [ ] `https://tienda.tudominio.com` → carga el storefront con el nombre del cliente
- [ ] `https://api.tudominio.com/app` → carga el panel admin
- [ ] SSL activo (candado verde) en frontend y backend
- [ ] Completar un checkout de prueba con Stripe live → confirmar que el pago se procesa
- [ ] Verificar que se recibe email de confirmación de pedido vía Resend
- [ ] Subir una imagen de producto desde el admin → confirmar que se guarda en R2
- [ ] Las imágenes de productos son visibles en el storefront (valida `next.config.js` R2)
- [ ] `https://tienda.tudominio.com/sitemap.xml` → accesible y con URLs reales
