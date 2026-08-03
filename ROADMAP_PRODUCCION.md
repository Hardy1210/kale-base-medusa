# Roadmap a producción

Ruta de construcción para llevar este starter a producción **para un cliente nuevo**.
Detalle de cada punto en [`CLIENT_SETUP.md`](./CLIENT_SETUP.md) (personalización) y
[`PRODUCTION_DEPLOY.md`](./PRODUCTION_DEPLOY.md) (deploy).

**Stack de destino:** Hetzner (VPS) + Coolify + Postgres 16 + Redis 7 + Cloudflare R2
+ Stripe + Resend + Sentry.

---

## Cómo se usa este roadmap

Cada fase termina en una **🚪 Puerta**: una condición verificable. **No se pasa a la
siguiente fase sin cumplirla.** No es burocracia — cada puerta evita un tipo concreto
de retrabajo:

- Saltarse la Fase 1 hace que reconstruyas regiones e impuestos después de cargar el catálogo.
- Saltarse la Fase 3 te lleva a producción sin saber que los emails fallan.
- Saltarse la Fase 6 abre una tienda con secretos por defecto y la base de datos expuesta.

Las fases 0–4 se hacen **en local, sin gastar un céntimo en servidor**. La infraestructura
(Fase 5) es lo último que se contrata.

**Progreso estimado del starter base: ~60%.** La app está lista (pagos, emails,
notificaciones, catálogo, observabilidad). Falta personalización por cliente + infra.

---

## Fase 0 — Base funcionando en local

**Objetivo:** confirmar que el starter arranca **antes** de tocar nada. Si algo falla
aquí, no es culpa de tus cambios.

- [ ] `cd medusa && cp .env.template .env` y rellenar lo mínimo (DB, Redis, S3 local)
- [ ] `docker compose up -d` desde `medusa/` (Postgres, Redis, MinIO)
- [ ] `corepack yarn && corepack yarn build && corepack yarn medusa db:migrate`
- [ ] `corepack yarn seed` + crear usuario admin
- [ ] `cd storefront && cp .env.template .env.local`, pegar la publishable key del admin
- [ ] Ambos `yarn dev` levantados

**🚪 Puerta:** un pedido de prueba completo de principio a fin en local — añadir al
carrito, checkout con tarjeta de test de Stripe, pedido visible en el admin.

---

## Fase 1 — Ficha legal y fiscal del cliente

**Objetivo:** responder las preguntas que **determinan el código**. Va antes que la
marca porque cambia regiones, impuestos y facturación, y rehacer eso después de
importar el catálogo duele.

- [ ] **País de tributación** del cliente (no dónde vende — dónde declara)
- [ ] **Forma jurídica y régimen de IVA**
  - 🇫🇷 Francia: ¿*micro-entreprise* en **franchise en base de TVA**? Umbrales 2026 para
    venta de mercancías: **85.000 €** (base) / 93.500 € (majoré).
    - **Sí** → no cobra IVA. Las regiones fiscales al **0 %** del seed son **correctas**.
      Obligatorio incluir en las facturas: «TVA non applicable, article 293 B du CGI».
    - **No** → hay que configurar los tipos de IVA reales en el admin (Settings → Tax Regions).
      El seed los crea **vacíos**: sin esto la tienda cobra 0 % de IVA.
- [ ] **Países donde va a vender.** Por defecto el seed abre 8 (`hr, gb, de, dk, se, fr, es, it`).
  - Recomendación: **dejar solo el país del cliente al lanzar.** Vender a otro país de la
    UE convierte la factura en **obligatoria** (venta a distancia intracomunitaria), y
    superar 10.000 €/año de ventas B2C intra-UE obliga a IVA de destino + registro **OSS**.
  - `gb` ya no es UE: aduanas. Fuera salvo petición expresa.
  - Es reversible sin código: Settings → Regions en el admin.
- [ ] **¿Vende a empresas (B2B)?**
  - Sí → necesita capturar el **NIF / n.º de TVA** en el checkout. **Hoy no existe ese campo**
    (`storefront/src/modules/checkout/components/billing_address/index.tsx` solo tiene `company`).
    Es desarrollo adicional, presupuéstalo.
- [ ] **Facturación**: decidir la vía antes de lanzar
  - **No construir facturas dentro de Medusa.** Ni numeración, ni PDFs. En España sería
    ilegal (Verifactu, RD 1007/2023, sanciones hasta 50.000 €) y en Francia no cumple el
    formato exigido. Medusa lleva pedidos; el software certificado lleva facturas.
  - Volumen bajo → manual desde el software del contable. Volumen alto o B2B →
    integración con herramienta con API (Pennylane, Sellsy, Tiime, Holded, B2Brouter).
- [ ] 🇫🇷 **Calendario de facturación electrónica** — confirmar con su experto-contable:
  - **1 sept 2026:** todas las empresas deben poder **recibir** facturas electrónicas
    → necesita cuenta en una **Plateforme Agréée (PA)**. Es trámite administrativo, **no toca el código**.
  - **1 sept 2027:** TPE/PME deben **emitir** + hacer **e-reporting** de las ventas B2C
    (datos agregados por día, vía la PA). **Esto sí tocará Medusa** → ver Fase 8.

**🚪 Puerta:** documento con las respuestas, validado por el contable del cliente.
Sin esto no se toca ni una línea.

---

## Fase 2 — Marca, contenido y catálogo

**Objetivo:** que la tienda sea del cliente, no del starter.

- [ ] `storefront/src/lib/brand.ts` — nombre, descripción, SEO de home/store/about
- [ ] Reemplazar `"Mi Tienda"`: `Header.tsx`, `Footer.tsx`, checkout `layout.tsx`,
      páginas de `auth`, y `medusa-config.js` (`siteTitle`, `companyName`, `footerLinks`)
- [ ] `storefront/public/images/og-default.jpg` (preview en redes)
- [ ] Variables: `NEXT_PUBLIC_INSTAGRAM_URL`, `NEXT_PUBLIC_BASE_URL`
- [ ] **Regiones**: dejar solo las decididas en la Fase 1 (admin → Settings → Regions)
- [ ] **Impuestos**: configurar los tipos según la Fase 1 (o confirmar que 0 % es correcto)
- [ ] **Páginas legales** — hoy son plantillas genéricas, hay que redactarlas con el cliente:
      `privacy-policy`, `terms-of-use`, `cookie-policy`. 🇫🇷 Añadir **Mentions légales**
      (obligatorias en Francia) y **CGV**.
- [ ] Importar el catálogo CSV del cliente (admin → Products → Import)
- [ ] Sustituir las imágenes del seed por las del cliente

**🚪 Puerta:** navegar la tienda entera sin encontrar ni un texto o imagen del starter
("Sofa Society", "Mi Tienda", sofás de demo).

---

## Fase 3 — Emails, notificaciones y observabilidad

**Objetivo:** que el cliente **se entere** de que ha vendido, y que tú te enteres si eso se rompe.

**Qué envía el sistema hoy** (verificado en código):

| Email | A quién | Cuándo |
|---|---|---|
| `order-placed` | Comprador | Cada pedido |
| `order-update` | Comprador | Cada fulfillment (despacho) |
| `order-placed-merchant` | **Comerciante** | Cada pedido — requiere `MERCHANT_NOTIFICATION_EMAIL` |
| `customer-welcome` | Cliente | Solo al registrarse con cuenta |
| `auth-password-reset` | Cliente | A petición |

Más una notificación en la **campanita del admin** por cada pedido (sin configuración).

⚠️ **Stripe NO envía ningún email al comprador.** Medusa nunca le pasa `receipt_email`.
El comprador recibe **un solo email** por su compra: la confirmación de Medusa. No le
digas al cliente que Stripe manda un recibo.

- [ ] **Traducir las 6 plantillas** de `medusa/src/modules/resend/emails/` al idioma del
      cliente. Hoy están en inglés con texto placeholder de "Sofa Society" e
      `info@sofasociety.com` **hardcodeado**. Revisar también los `subjects` en `emails/index.ts`.
- [ ] `RESEND_FROM` con el dominio del cliente
- [ ] `EMAIL_REPLY_TO` → buzón real (`contact@`), para que las respuestas lleguen a alguien
- [ ] **`MERCHANT_NOTIFICATION_EMAIL`** → buzón que el cliente mire de verdad.
      **Sin esta variable no se envía el aviso de venta.**
- [ ] `SENTRY_DSN` + **crear la regla de alerta en Sentry**. Sin la regla el error se
      queda en el dashboard y nadie lo mira; es el paso que se olvida siempre.
- [ ] Enseñar al cliente a activar en **su** cuenta Stripe (cero código, 2 minutos):
      Settings → Profile → Communication preferences → *Successful payments*, y las push
      de la app móvil de Stripe. Es una señal de venta independiente de Resend.
- [ ] **Dimensionar la cuota.** Resend gratis: **100 emails/día**, 3.000/mes.
      A 3 emails por venta son ~33 pedidos/día de techo; recomendado no pasar de ~20/día
      sostenidos. Si el cliente proyecta más, Resend Pro son 20 $/mes sin límite diario.
      Alternativa gratuita mayor: Brevo (300/día) — módulo ya escrito y comentado en
      `medusa-config.js`, pero **estampa "Sent with Brevo"** en cada email.

**🚪 Puerta:** pedido de prueba que dispara y entrega **los 3 emails** (comprador,
comerciante, y el de envío al marcar fulfillment), campanita con el pedido visible, y un
error provocado a propósito en Resend que **llega a Sentry como alerta**.

---

## Fase 4 — Código listo para desplegar

**Objetivo:** que el repo se pueda construir en un servidor.

- [ ] Crear `medusa/Dockerfile` (contenido listo en `PRODUCTION_DEPLOY.md` §1)
- [ ] Crear `storefront/Dockerfile` (contenido listo en `PRODUCTION_DEPLOY.md` §1)
- [ ] `storefront/next.config.js` — añadir el dominio de R2 en `remotePatterns`
- [ ] `corepack yarn build` en `medusa/` y `yarn build` en `storefront/`: **ambos sin errores**
- [ ] `yarn lint` en `storefront/` limpio (es lo que corre el CI)
- [ ] Commit + push a la rama

**🚪 Puerta:** los dos builds pasan en limpio desde cero y el CI de GitHub está verde.

---

## Fase 5 — Infraestructura (Hetzner + Coolify)

**Objetivo:** levantar el entorno. Primer gasto real.

- [ ] VPS en Hetzner (CX22 o superior) + instalar Coolify
- [ ] Coolify: proyecto + **Postgres 16** + **Redis 7** como servicios gestionados
- [ ] Cloudflare R2: bucket + CORS + API token **restringido a ese bucket**
- [ ] Coolify: apps `medusa-backend` y `storefront` desde el repo
- [ ] Variables de entorno en la UI de Coolify (listado completo en `PRODUCTION_DEPLOY.md` §3)
- [ ] Dominio + DNS apuntando al VPS + **SSL emitido** (Let's Encrypt vía Coolify)
- [ ] Deploy en orden: backend → migraciones → usuario admin → publishable key → storefront
- [ ] **Verificar dominio en Resend**: registros **SPF, DKIM y DMARC** en DNS.
      Sin esto los emails van a spam o se rechazan.

**🚪 Puerta:** `https://api.dominio.com/health` responde OK, el admin carga en `/app` con
SSL válido, y el storefront carga con SSL válido.
*(Nota: `/health` solo existe con `medusa start` — el comando de producción. En
`medusa develop` no está.)*

---

## Fase 6 — Auditoría de seguridad

**Objetivo:** cerrar la casa antes de abrirla al público. **Obligatoria.** Nada de esto
es opcional y ninguno es caro — lo caro es saltárselo.

### Secretos
- [ ] `JWT_SECRET` y `COOKIE_SECRET` generados con `openssl rand -hex 32`.
      **Nunca `supersecret`**, que es el valor por defecto en `medusa-config.js`
- [ ] Secretos distintos entre local y producción, y distintos por cliente
- [ ] `.env` **no** commiteado (ya está en `.gitignore`, verifícalo con `git log -- medusa/.env`)
- [ ] Ninguna clave secreta en variables `NEXT_PUBLIC_*` — **son públicas en el navegador**
- [ ] `REVALIDATE_SECRET` definido y no trivial
- [ ] Claves de API con el mínimo alcance: token R2 solo a su bucket, API key de Resend
      solo de envío

### Red y servidor
- [ ] **Postgres y Redis NO expuestos a internet.** Solo red interna de Coolify.
      Verifícalo desde fuera: `nc -zv IP 5432` y `nc -zv IP 6379` deben fallar
- [ ] Firewall de Hetzner: solo **22, 80, 443** abiertos
- [ ] SSH con **clave, sin contraseña** (`PasswordAuthentication no`); root sin login directo
- [ ] Actualizaciones de seguridad automáticas (`unattended-upgrades`)
- [ ] Panel de Coolify con contraseña fuerte y **2FA activado**

### Aplicación
- [ ] `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS` con los **dominios reales**. Nunca `*`
- [ ] HTTPS forzado con redirección desde HTTP, y HSTS activado
- [ ] Usuario admin con contraseña fuerte, guardada en gestor de contraseñas.
      Borrar cualquier usuario de prueba del seed
- [ ] `STRIPE_WEBHOOK_SECRET` configurado — sin él el webhook acepta peticiones falsas
- [ ] `corepack yarn npm audit` en `medusa/` y `yarn audit` en `storefront/`:
      cero vulnerabilidades críticas o altas
- [ ] `robots.txt` **sin `Disallow: /`** (si no, Google no indexa nada)

### Datos y RGPD 🇫🇷
- [ ] **Backup automático de Postgres** configurado en Coolify
- [ ] **Restauración probada al menos una vez.** Un backup no verificado no es un backup
- [ ] Banner de consentimiento de cookies si hay analytics/marketing (obligatorio en la UE).
      Verificar qué recoge `@agilo/medusa-analytics-plugin` antes de lanzar
- [ ] Política de privacidad con: responsable del tratamiento, finalidad, plazo de
      conservación y cómo ejercer los derechos RGPD
- [ ] Vía real para atender borrado/acceso de datos personales

**🚪 Puerta:** checklist completo, con los puertos comprobados desde fuera y una
restauración de backup ejecutada de verdad.

---

## Fase 7 — Producción y verificación final

**Objetivo:** abrir, con Stripe cobrando de verdad.

- [ ] Stripe en **modo live**: claves live + webhook a `/hooks/payment/stripe`
- [ ] **Compra real** con tarjeta propia (importe pequeño) → el pago aparece en Stripe live
- [ ] Llegan: confirmación al comprador **y** aviso al comerciante
- [ ] Marcar el pedido como fulfilled → llega el email "va en camino"
- [ ] Campanita del admin muestra el pedido
- [ ] Reembolsar esa compra de prueba desde Stripe y confirmar que se procesa
- [ ] Subir una imagen de producto → se guarda en R2 y se ve en el storefront
- [ ] `sitemap.xml` con URLs reales → enviar a Google Search Console
- [ ] Probar el checkout en **móvil real**, no solo en el simulador del navegador
- [ ] Entregar al cliente: credenciales del admin, cómo despachar un pedido, a quién
      llamar si algo falla

**🚪 Puerta:** una venta real de principio a fin, con su reembolso, y el cliente sabiendo
operar el admin sin ayuda.

---

## Fase 8 — Después del lanzamiento

- [ ] Vigilar Sentry la primera semana: los fallos de email salen ahí
- [ ] Revisar el consumo de Resend al mes (límite de 3.000/mes en el plan gratis)
- [ ] Confirmar que los backups se están ejecutando de verdad
- [ ] 🇫🇷 **Antes de sept 2027:** conectar el e-reporting B2C. La vía normal es
      Medusa → herramienta de facturación → Plateforme Agréée → DGFiP.
      En Medusa es **un subscriber sobre `order.placed`** que hace POST a la API de la
      herramienta (~100 líneas, mismo patrón que los subscribers existentes).
      A escala micro, alternativa sin código: export CSV mensual que procesa la gestoría.
      Elige la herramienta de la Fase 1 pensando ya en esto para no migrar dos veces.

---

## ¿Qué es un Dockerfile? (obligatorio para este stack)

Es la "receta" que empaqueta la app (código + Node + dependencias) en un contenedor que
corre idéntico en local y en el servidor. Con Coolify **se necesita uno por app**
(`medusa/Dockerfile` y `storefront/Dockerfile`). El contenido ya está escrito en
`PRODUCTION_DEPLOY.md` §1, listo para pegar. Es un archivo por app, se hace una vez.

## Backlog / opcional (solo si el cliente lo pide)

- [ ] **Gestión de contenido editorial (páginas About / Inspiration)** — que el cliente
  edite él mismo esos textos/imágenes desde el admin. Hoy están hardcodeados en
  `storefront/src/app/[countryCode]/(main)/about/page.tsx` e `inspiration/page.tsx`
  (un dev debe editarlos y redesplegar).
  **Enfoque acordado (Opción 2):** módulo de contenido propio en Medusa (entidad tipo
  `page` con campos de texto/imagen) + ruta de admin para editarla — todo dentro de
  Medusa, sin CMS externo. Es **viable**; se construye cuando lo soliciten.
- [ ] **Campo NIF / n.º de TVA en el checkout** — necesario para vender a empresas
- [ ] **Recibo de pago de Stripe al comprador** — hoy no sale. Requiere código: el
  proveedor de Stripe de Medusa filtra los campos del PaymentIntent con una lista blanca
  de 11 y `receipt_email` no está. Habría que parchear el paquete, extender la clase del
  proveedor, o actualizar el PaymentIntent con un subscriber. **No recomendado para el
  starter**: frágil entre versiones de Medusa y la confirmación de Medusa ya cubre la
  función legal y comercial.
- [ ] **Emails de pedido cancelado / reembolsado** — no existen hoy

## Notas de entorno local (esta máquina)

Puertos remapeados por conflicto con otro proyecto (ver `CLAUDE.md`): backend `9002`,
Redis `6380`, MinIO `9090`/`9091`. Arranque: `docker compose up -d` desde `medusa/`,
luego `corepack yarn dev` en `medusa/` y en `storefront/`.

`yarn` no está en el PATH global de esta máquina: usa **`corepack yarn`** en `medusa/`
(Yarn 4). El storefront usa Yarn 1.
