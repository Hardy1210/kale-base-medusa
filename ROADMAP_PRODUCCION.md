# Roadmap a producción

Estado y pasos para llevar este starter a producción para un cliente nuevo.
Detalle de cada punto en `CLIENT_SETUP.md` (personalización) y `PRODUCTION_DEPLOY.md` (deploy).

> **Progreso estimado: ~50%.** El código/app está listo (pagos, emails, catálogo).
> Falta personalización del cliente + infraestructura. Fases 1 y 2 se hacen en
> local sin gastar en servidor; Hetzner/Coolify (Fase 3) es lo último.

---

## Fase 1 — Personalizar al cliente (local, sin infra)
- [ ] `storefront/src/lib/brand.ts` — nombre, descripción, SEO de home/store/about
- [ ] Reemplazar `"Mi Tienda"` en el código: `Header.tsx`, `Footer.tsx`, checkout `layout.tsx`, páginas de `auth`, y `medusa-config.js` (`siteTitle`, `companyName`, `footerLinks`)
- [ ] `storefront/public/images/og-default.jpg` (preview en redes)
- [ ] Variables: `RESEND_FROM`, `NEXT_PUBLIC_INSTAGRAM_URL`, `NEXT_PUBLIC_BASE_URL`
- [ ] Importar el catálogo CSV del cliente en el admin (Products → Import)

## Fase 2 — Preparar el código para deploy
- [ ] Crear `medusa/Dockerfile` (contenido en `PRODUCTION_DEPLOY.md` §1)
- [ ] Crear `storefront/Dockerfile` (contenido en `PRODUCTION_DEPLOY.md` §1)
- [ ] `storefront/next.config.js` — añadir el dominio de R2 en `remotePatterns`
- [ ] Commit + push a la rama

## Fase 3 — Infraestructura (Hetzner + Coolify + servicios)
- [ ] VPS en Hetzner + instalar Coolify
- [ ] Cloudflare R2: bucket + CORS + API token
- [ ] Stripe **live** + webhook (`/hooks/payment/stripe`)
- [ ] Verificar dominio en Resend/Brevo (DNS: SPF/DKIM/DMARC)
- [ ] Coolify: apps backend/storefront + Postgres 16 + Redis 7 + variables de entorno
- [ ] Deploy en orden → crear usuario admin → copiar publishable key
- [ ] Dominio + DNS + SSL

## Fase 4 — Verificación final
- [ ] `/health` responde OK; storefront y admin cargan con SSL
- [ ] Checkout de prueba con Stripe live procesa el pago
- [ ] Llega email de confirmación (Resend/Brevo)
- [ ] Subir imagen de producto → se guarda en R2 y se ve en el storefront
- [ ] `robots.txt` sin `Disallow: /` y `sitemap.xml` con URLs reales → enviar a Google Search Console

---

## ¿Qué es un Dockerfile? (obligatorio para este stack)
Es la "receta" que empaqueta la app (código + Node + dependencias) en un contenedor
que corre idéntico en local y en el servidor. Con Coolify **se necesita uno por app**
(`medusa/Dockerfile` y `storefront/Dockerfile`). El contenido ya está escrito en
`PRODUCTION_DEPLOY.md` §1, listo para pegar. Es un archivo por app, se hace una vez.

## Backlog / opcional (solo si el cliente lo pide)
- [ ] **Gestión de contenido editorial (páginas About / Inspiration)** — que la
  clienta edite ella misma esos textos/imágenes desde el admin. Hoy están
  hardcodeados en `storefront/src/app/[countryCode]/(main)/about/page.tsx` e
  `inspiration/page.tsx` (un dev debe editarlos y redesplegar).
  **Enfoque acordado (Opción 2):** módulo de contenido propio en Medusa (entidad
  tipo `page` con campos de texto/imagen) + ruta de admin para editarla — todo
  dentro de Medusa, sin CMS externo. Es **viable**; se puede construir cuando la
  clienta lo solicite. No incluido en el alcance actual.

## Notas de entorno local (esta máquina)
Puertos remapeados por conflicto con otro proyecto (ver `CLAUDE.md`): backend `9002`,
Redis `6380`, MinIO `9090`/`9091`. Arranque: `docker compose up -d` desde `medusa/`,
luego `corepack yarn dev` en `medusa/` y en `storefront/`.
