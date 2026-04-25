# Guía de configuración para el cliente

## Checklist para un cliente nuevo

### 1. SEO y marca — `storefront/src/lib/brand.ts`
**Este es el primer archivo que debes editar.** Contiene todos los textos SEO del storefront:

| Campo | Qué es |
|---|---|
| `name` | Nombre visible de la tienda (titles, footer, emails) |
| `description` | Metadescription global (aparece en Google) |
| `pages.home.title/description` | SEO de la home |
| `pages.store.description` | SEO de la tienda |
| `pages.about.title/description` | SEO del about |
| `organization.*` | Completar cuando actives Organization JSON-LD (ver nota abajo) |

> `brand.url` se lee automáticamente de `NEXT_PUBLIC_BASE_URL` — no editar en brand.ts.

**og:image por defecto:** añadir la imagen en `storefront/public/images/og-default.jpg`.
Sin este archivo, las páginas que no tienen imagen propia no tendrán preview en redes.

### 2. Branding en el código
Busca `Mi Tienda` en todo el proyecto y reemplaza por el nombre real del cliente:

| Archivo | Qué cambiar |
|---|---|
| `storefront/src/components/Header.tsx` | Nombre en la barra de navegación |
| `storefront/src/components/Footer.tsx` | Nombre y copyright del pie de página |
| `storefront/src/app/.../checkout/layout.tsx` | Nombre en el header del checkout |
| `storefront/src/app/.../auth/login/page.tsx` y `loading.tsx` | Texto de bienvenida en login |
| `storefront/src/app/.../auth/register/page.tsx` y `loading.tsx` | Texto de bienvenida en registro |
| `medusa/medusa-config.js` → `siteTitle`, `companyName`, `footerLinks` | Nombre y links en emails transaccionales |

### 3. Variables de entorno a personalizar
| Variable | Archivo | Valor para el cliente |
|---|---|---|
| `RESEND_FROM` | `medusa/.env` | `"Nombre Tienda <noreply@dominio.com>"` |
| `NEXT_PUBLIC_INSTAGRAM_URL` | `storefront/.env.local` | URL real de Instagram |
| `NEXT_PUBLIC_BASE_URL` | `storefront/.env.local` | URL pública del storefront en producción |

### 4. GitHub Actions — secretos CI/CD
En el repositorio GitHub → Settings → Secrets, verificar que estos secretos están configurados:
`BACKEND_URL`, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`, `STRIPE_KEY`, `REVALIDATE_SECRET`, `NEXT_PUBLIC_BASE_URL`

### 5. Bucket S3 en producción
En `storefront/next.config.js` hay un `TODO` para agregar el dominio S3 del cliente.
Descomentar y reemplazar con el hostname real del bucket.

### 6. Imágenes del seed
Las imágenes de demo del seed apuntan al CDN de Agilo (`assets.agilo.com`).
Solo afectan thumbnails de productos de demo, no la funcionalidad.
En producción, reemplazar con imágenes propias del cliente.

### 7. Organization JSON-LD (opcional pero recomendado)
Cuando el cliente tenga logo y URL definitiva, completar `brand.organization` en `brand.ts`
y añadir el script JSON-LD en `storefront/src/app/layout.tsx` siguiendo el mismo patrón
del JSON-LD de producto en `products/[handle]/page.tsx`.

---

## Variables que debes configurar obligatoriamente

### Backend (`medusa/.env`)

| Variable | Descripción |
|---|---|
| `STRIPE_API_KEY` | Clave secreta de Stripe (empieza con `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Secret del webhook de Stripe |
| `RESEND_API_KEY` | Clave de API de Resend para emails transaccionales |
| `RESEND_FROM` | Dirección de envío, ej: `Tu Tienda <noreply@tutienda.com>` |
| `JWT_SECRET` | Secret para firmar tokens JWT |
| `COOKIE_SECRET` | Secret para firmar cookies de sesión |

### Storefront (`storefront/.env.local`)

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | Clave publicable de Medusa (ver paso 4 abajo) |
| `NEXT_PUBLIC_STRIPE_KEY` | Clave pública de Stripe (empieza con `pk_live_...`) |
| `REVALIDATE_SECRET` | Secret para revalidación de caché de Next.js |
| `NEXT_PUBLIC_BASE_URL` | URL pública del storefront en producción |
| `NEXT_PUBLIC_INSTAGRAM_URL` | URL de tu perfil de Instagram (o `#` si no aplica) |

---

## Generar secrets seguros

Ejecuta este comando para cada secret (`JWT_SECRET`, `COOKIE_SECRET`, `REVALIDATE_SECRET`):

```bash
openssl rand -hex 32
```

Nunca uses `supersecret` ni valores por defecto en producción.

---

## Levantar el proyecto en local

```bash
# 1. Levantar base de datos, Redis y MinIO
cd medusa
docker-compose up -d

# 2. Ejecutar migraciones
yarn medusa db:migrate

# 3. Cargar datos de demo (opcional)
yarn seed

# 4. Crear usuario administrador
yarn medusa user -e "admin@tutienda.com" -p "tupassword"

# 5. Iniciar el backend
yarn dev
```

Accede al admin en http://localhost:9000/app. Ve a **Settings → Publishable API Keys**, copia la clave y pégala en `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` del storefront.

```bash
# En otra terminal
cd storefront
yarn dev
```

El storefront estará disponible en http://localhost:8000.

---

## Variables que cambian entre local y producción

| Variable | Local | Producción |
|---|---|---|
| `BACKEND_URL` | `http://localhost:9000` | URL pública del backend |
| `STOREFRONT_URL` | `http://localhost:8000` | URL pública del storefront |
| `STORE_CORS` | `http://localhost:8000` | URL pública del storefront |
| `ADMIN_CORS` | `http://localhost:7000,http://localhost:7001` | URL del panel admin en prod |
| `AUTH_CORS` | `http://localhost:7000,http://localhost:7001` | URL del panel admin en prod |
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | `http://localhost:9000` | URL pública del backend |
| `NEXT_PUBLIC_BASE_URL` | `http://localhost:8000` | URL pública del storefront |
| `STRIPE_API_KEY` | `sk_test_...` | `sk_live_...` |
| `NEXT_PUBLIC_STRIPE_KEY` | `pk_test_...` | `pk_live_...` |
| `S3_ENDPOINT` | `http://localhost:9090` (MinIO local) | URL de tu bucket S3 en prod |
| `S3_FILE_URL` | `http://localhost:9090/medusa` | URL pública de archivos S3 |
