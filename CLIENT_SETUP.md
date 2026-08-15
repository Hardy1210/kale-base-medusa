# Guía de configuración para el cliente

## Checklist para un cliente nuevo

> ## 🏷️ El nombre de la tienda se cambia en DOS sitios. Nada más.
>
> | Dónde | Qué cubre |
> |---|---|
> | **`storefront/src/lib/brand.ts`** → `name` | Todo el storefront: header, footer, checkout, titles, SEO, sitemap |
> | **`medusa/.env`** → `STORE_NAME` | Todos los emails: asuntos, cuerpo, cabecera y pie |
>
> **No busques literales por el proyecto.** Desde el commit que centralizó la marca no
> queda ni un nombre escrito a mano en componentes ni en plantillas de email. Si alguna
> vez añades uno nuevo, usa `brand.name` (storefront) o `props.siteTitle` (emails).

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

### 2. Branding en el código — ✅ ya no hay nada que buscar

Estos archivos **ya leen el nombre de `brand.name`**. No los toques:

- `storefront/src/components/Header.tsx` — barra de navegación
- `storefront/src/components/Footer.tsx` — nombre y copyright
- `storefront/src/app/[countryCode]/(checkout)/layout.tsx` — header del checkout (×2)

Y estos **ya leen `STORE_NAME` del `.env`** a través de `medusa-config.js`, que inyecta
`siteTitle` / `companyName` / `contactEmail` en **todas** las plantillas:

- `medusa/src/modules/resend/emails/*.tsx` — las **6** plantillas activas
- `medusa/src/modules/resend/emails/index.ts` — los asuntos

> En esa carpeta hay 7 ficheros `.tsx`, pero solo 6 están registrados en `index.ts`:
> `auth-email-confirm.tsx` no se usa. Si lo traduces, no cambia nada.

> Las páginas de `auth` (login/register) solo dicen "Welcome back!", sin nombre de
> tienda: no hay nada que reemplazar ahí.

**Lo que sí hay que reescribir por cliente** (es contenido, no configuración — ver punto 6):
las páginas legales, la home y el `about`, que todavía traen texto del starter en inglés.

### 3. Variables de entorno a personalizar
| Variable | Archivo | Valor para el cliente |
|---|---|---|
| `STORE_NAME` | `medusa/.env` | Nombre de la tienda — **alimenta todos los emails** |
| `EMAIL_REPLY_TO` | `medusa/.env` | Buzón de contacto: sale como reply-to **y** dentro del email de confirmación de pedido |
| `RESEND_FROM` | `medusa/.env` | `"Nombre Tienda <noreply@dominio.com>"` |
| `NEXT_PUBLIC_INSTAGRAM_URL` | `storefront/.env.local` | URL real de Instagram |
| `NEXT_PUBLIC_BASE_URL` | `storefront/.env.local` | URL pública del storefront en producción |

### 4. GitHub Actions — secretos CI/CD
En el repositorio GitHub → Settings → Secrets, configurar estos cinco. **Los nombres
tienen que ser exactamente estos**, son los que lee `.github/workflows/node.js.yml`:

- `NEXT_PUBLIC_MEDUSA_BACKEND_URL`
- `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_STRIPE_KEY`
- `NEXT_PUBLIC_BASE_URL`
- `REVALIDATE_SECRET`

> Antes aquí ponía `BACKEND_URL` y `STRIPE_KEY`. Eran incorrectos: con esos nombres el
> workflow no encuentra los valores y el CI se queda en rojo sin motivo aparente.

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
| `RESEND_API_KEY` | Clave de API de Resend para emails transaccionales (proveedor activo por defecto) |
| `RESEND_FROM` | Dirección de envío, ej: `Tu Tienda <noreply@tutienda.com>` |
| `EMAIL_REPLY_TO` | Dirección a la que responden los clientes, ej: `contact@tutienda.com`. Vacío = sin reply-to. Ver sección _Proveedor de email_ |
| `MERCHANT_NOTIFICATION_EMAIL` | **Buzón del comerciante.** Sin esto no se envía el aviso de venta — ver _Proveedor de email_ |
| `JWT_SECRET` | Secret para firmar tokens JWT. En producción Medusa **no arranca** si falta, si vale `supersecret` o si tiene menos de 32 caracteres |
| `COOKIE_SECRET` | Secret para firmar cookies de sesión. Mismas reglas que `JWT_SECRET` |
| `REDIS_URL` | **Obligatoria.** Sostiene caché, bus de eventos y motor de workflows. Sin ella Medusa no arranca |

> **Alternativa Brevo:** si en vez de Resend usas Brevo, configura `BREVO_API_KEY` y `BREVO_FROM` en lugar de las de Resend, y actívalo en `medusa-config.js` (ver sección _Proveedor de email_).

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

## Proveedor de email (Resend / Brevo)

Los emails transaccionales usan un **proveedor de notificaciones** intercambiable
(canal `email` en `medusa-config.js`). Las **plantillas** (`src/modules/resend/emails/`)
son React Email y **no dependen del proveedor**: cambiar de Resend a Brevo no altera
ninguna plantilla ni ningún subscriber.

### Emails que se envían actualmente

| Email | Evento | Destinatario |
|---|---|---|
| Confirmación de compra | `order.placed` | comprador (registrado o invitado) |
| **Aviso de venta** | `order.placed` | **el comerciante** — requiere `MERCHANT_NOTIFICATION_EMAIL` |
| Pedido en camino | `order.fulfillment_created` | comprador — se dispara al marcar el pedido como preparado/enviado en el admin |
| Bienvenida | `customer.welcome` | cliente registrado |
| Reset de contraseña | `auth.password_reset` | cliente |

Más una notificación en la **campanita del admin** por cada pedido, que funciona sin
configurar nada.

> ### ⚠️ `MERCHANT_NOTIFICATION_EMAIL` no es opcional
>
> **Sin esa variable el aviso de venta no se envía.** El subscriber existe, comprueba si
> está definida y, si no lo está, se limita a escribir un `warn` en el log y no hace
> nada más. La tienda funciona con normalidad y el cliente **no se entera de que ha
> vendido** hasta que entra al admin por su cuenta.
>
> Ponla apuntando a un buzón que el cliente mire de verdad. Es la única señal automática
> de que hay un pedido que preparar.

> No hay emails de pedido cancelado ni reembolsado: esos casos se gestionan desde el
> admin de Medusa.

⚠️ **Stripe no manda ningún email al comprador.** Medusa nunca le pasa `receipt_email`,
así que el comprador recibe **un solo email** por su compra: la confirmación de Medusa.
No le prometas al cliente que Stripe envía un recibo.

### Reply-To (`contact@`)

Define `EMAIL_REPLY_TO=contact@dominio-cliente.com` en `medusa/.env`. Es un **buzón del
dominio del cliente** (su hosting de correo, no Brevo/Resend) al que llegan las respuestas.
Vacío = los emails salen sin reply-to. No requiere formulario de contacto: basta publicar
esa dirección en el footer / mentions légales.

### Activar Brevo en vez de Resend

El módulo `src/modules/brevo` ya está montado pero **inactivo** (Resend es el proveedor
activo). Para migrar:

1. En `medusa/.env`: define `BREVO_API_KEY` y `BREVO_FROM`.
2. En `medusa/medusa-config.js`, dentro del módulo `notification`: **comenta** el proveedor
   `resend` y **descomenta** el bloque `brevo` (ya está escrito con instrucciones).
3. Verifica el dominio del remitente en Brevo (SPF/DKIM/DMARC) y reinicia el backend.

Las campañas de marketing (newsletters) las gestiona el cliente directamente desde la
consola de Brevo; eso es independiente de este código.

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
