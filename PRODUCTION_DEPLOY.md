# Deploy en producción

**Este documento empieza donde `CLIENT_SETUP.md` termina.**
Úsalo cuando el código ya está configurado para el cliente y hay que subirlo a producción.

**Stack:** Hetzner VPS · Coolify · Cloudflare R2 · Stripe · Resend · PostgreSQL 16 · Redis 7

---

## 1. Preparación del código

- [ ] Crear `medusa/Dockerfile`:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
RUN corepack enable && yarn install --frozen-lockfile
COPY . .
RUN yarn build
EXPOSE 9000
CMD ["yarn", "start"]
```

- [ ] Crear `storefront/Dockerfile`
  *(los `NEXT_PUBLIC_*` deben pasarse como build args — Coolify los inyecta automáticamente):*

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

ARG NEXT_PUBLIC_MEDUSA_BACKEND_URL
ARG NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_DEFAULT_REGION
ARG NEXT_PUBLIC_STRIPE_KEY
ARG REVALIDATE_SECRET

ENV NEXT_PUBLIC_MEDUSA_BACKEND_URL=$NEXT_PUBLIC_MEDUSA_BACKEND_URL
ENV NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=$NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_DEFAULT_REGION=$NEXT_PUBLIC_DEFAULT_REGION
ENV NEXT_PUBLIC_STRIPE_KEY=$NEXT_PUBLIC_STRIPE_KEY
ENV REVALIDATE_SECRET=$REVALIDATE_SECRET

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 8000
CMD ["yarn", "start", "-p", "8000"]
```

- [ ] En `storefront/next.config.js`, añadir el dominio R2 en `remotePatterns`:

```js
{
  protocol: "https",
  hostname: "*.r2.cloudflarestorage.com",
},
```

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
  - **Release Command:** `yarn medusa db:migrate`
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

# Secrets — generar con: openssl rand -hex 32
JWT_SECRET=
COOKIE_SECRET=

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
  - Eventos: `payment_intent.succeeded`, `payment_intent.payment_failed`
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
- [ ] Deploy **medusa-backend** → verificar que el Release Command (`db:migrate`) corrió sin errores
- [ ] Ejecutar una vez (SSH al VPS o terminal de Coolify):

```bash
cd /app
yarn medusa user -e "admin@tudominio.com" -p "password-seguro"
```

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
