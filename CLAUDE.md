# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **📍 Estado del proyecto → ver [`ROADMAP_PRODUCCION.md`](./ROADMAP_PRODUCCION.md)** para las fases pendientes hacia producción (personalización del cliente, Dockerfiles, deploy en Hetzner/Coolify). Leer al abrir el proyecto.

## Overview

This is a **Medusa 2 e-commerce monorepo** with two independent packages:
- **`medusa/`** — Medusa 2.8.8 backend (Node.js, PostgreSQL, Redis)
- **`storefront/`** — Next.js 15 App Router frontend (React 19, Tailwind CSS)

The two packages use **different Yarn versions** and are managed separately (no root-level workspaces).

## Development Setup

### Prerequisites
- Node >= 20
- Docker & Docker Compose
- Yarn v4 (for medusa) and Yarn v1 (for storefront)

### Backend

```bash
cd medusa
cp .env.template .env          # Fill in secrets (Stripe, Resend, etc.)
yarn
docker-compose up -d           # PostgreSQL (5433), Redis (6379), MinIO (9000/9001)
yarn build
yarn medusa db:migrate
yarn seed                      # Load sample data
yarn medusa user -e "admin@medusa.local" -p "supersecret"
yarn dev                       # Runs on http://localhost:9000
```

### Storefront

```bash
cd storefront
cp .env.template .env.local
# Set NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY from http://localhost:9000/app/settings/publishable-api-keys
yarn
yarn dev                       # Runs on http://localhost:8000
```

## Key Commands

### Medusa Backend (`medusa/`)
| Command | Description |
|---|---|
| `yarn dev` | Start dev server with hot reload |
| `yarn build` | Compile TypeScript |
| `yarn medusa db:migrate` | Run pending DB migrations |
| `yarn seed` | Seed database with sample data |
| `yarn test:unit` | Run unit tests |
| `yarn test:integration:http` | HTTP integration tests |
| `yarn test:integration:modules` | Module integration tests |
| `yarn emails:dev` | Preview email templates |

### Storefront (`storefront/`)
| Command | Description |
|---|---|
| `yarn dev` | Dev server (Turbo mode, port 8000) |
| `yarn build` | Production build |
| `yarn lint` | ESLint |
| `yarn test-e2e` | Playwright E2E tests |
| `yarn analyze` | Bundle size analysis |

## Architecture

### Medusa Backend Structure

```
medusa/src/
├── api/            # REST routes (/store, /admin) — file-based routing
├── admin/          # Admin dashboard customizations (widgets, routes)
├── modules/
│   ├── fashion/    # Custom module: Material + Color models with MedusaService
│   └── resend/     # Transactional email provider (Resend)
├── workflows/      # Business logic (Medusa workflow pattern)
├── subscribers/    # Event handlers
├── jobs/           # Async background jobs
├── links/          # Module link definitions
└── scripts/        # Seed and migration scripts
```

**API Routes:** `src/api/[section]/[resource]/route.ts`. Access DI container via `req.scope`. Middleware at `src/api/middlewares.ts`.

**Custom Modules:** Follow the `MedusaService` pattern. Register in `medusa-config.js` under `modules`.

**Workflows:** Use Medusa's `createWorkflow` / `createStep` pattern for composable business logic.

### Storefront Structure

```
storefront/src/
├── app/[countryCode]/
│   ├── (main)/     # Store, product, collection, account pages
│   └── (checkout)/ # Checkout flow
├── modules/        # Feature-specific UI components
├── components/     # Shared UI components
├── hooks/          # React Query hooks for data fetching
├── lib/            # Utilities, Medusa SDK client, helpers
└── types/          # TypeScript types
```

**Routing:** Country-code prefix on all routes (e.g., `/fr/products`). Default region: `fr`.

**Data Fetching:** Tanstack Query v5 with Medusa JS SDK. Cache revalidation uses `REVALIDATE_SECRET`.

### Infrastructure (Docker)
Start from `medusa/` with `docker compose up -d` (run it **inside** `medusa/`, no `-f`, so Compose auto-loads any local `docker-compose.override.yml`).

Default host ports:
- **PostgreSQL 16** — host port 5433 → 5432 (non-standard to avoid conflicts)
- **Redis 7** — host port 6379 → 6379
- **MinIO** — S3-compatible storage, API on host 9090 → 9000, Console on host 9001

**Local port conflicts:** if another project on the same machine already binds 6379 (Redis) or 9000–9001 (MinIO), the container fails with `port is already allocated`. Don't stop the other project and don't change the committed `docker-compose.yml` — instead create a git-ignored `medusa/docker-compose.override.yml` that remaps only the host ports, then update the affected value in `medusa/.env` (e.g. `REDIS_URL`). Use the `!override` YAML tag on the `ports:` list so Compose replaces the base mapping instead of concatenating it:

```yaml
services:
  redis:
    ports: !override
      - "6380:6379"      # then set REDIS_URL=redis://localhost:6380 in .env
  minio:
    ports: !override
      - "9090:9000"
      - "9091:9001"      # host console remapped; S3 API stays on 9090
```

This override is machine-local only — it never ships to clients or production (prod uses Coolify-managed Postgres/Redis, not this compose).

The Medusa dev server itself defaults to host port **9000** (`yarn dev` serves both the store API and the admin at `/app`). If 9000 is taken by another local project, set `PORT` in `medusa/.env` (e.g. `PORT=9002`), point `BACKEND_URL` at it, and match `NEXT_PUBLIC_MEDUSA_BACKEND_URL` in `storefront/.env.local`. Both `.env` files are git-ignored, so this stays local.

## Medusa Config Highlights (`medusa/medusa-config.js`)
- **Payment:** Stripe — solo tarjeta. El checkout usa la API antigua de Stripe
  (`<CardElement>` + `createToken` + `confirmCardPayment`), no `<PaymentElement>`.
  Consecuencia: **Google Pay / Apple Pay no funcionan** aunque se activen en el dashboard
  de Stripe, y tampoco SEPA, Klarna ni iDEAL. Hay un plan de integración detallado
  (enfoque, ficheros a tocar y estimación) en el **Backlog** de
  [`ROADMAP_PRODUCCION.md`](./ROADMAP_PRODUCCION.md). **Pendiente: no empezar hasta que el
  usuario lo pida explícitamente.**
- **File Storage:** S3 (MinIO locally)
- **Email:** Resend provider (custom module)
- **Custom module:** `./src/modules/fashion` registered as `fashionModuleService`
- **Analytics:** `@agilo/medusa-analytics-plugin`

## Testing

**Backend Jest** (configured via `TEST_TYPE` env var):
```bash
TEST_TYPE=unit yarn test:unit
TEST_TYPE=integration:http yarn test:integration:http
TEST_TYPE=integration:modules yarn test:integration:modules
```

**Storefront Playwright:** Tests in `storefront/e2e/`. Requires a running backend. Two test projects: `chromium` (auth flow) and public routes.

## CI/CD

GitHub Actions runs on PRs to `master` that touch `storefront/**`. It runs `yarn lint` against Node 20.x and 22.x. Required secrets (exact names, as read by `.github/workflows/node.js.yml`): `NEXT_PUBLIC_MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STRIPE_KEY`, `NEXT_PUBLIC_BASE_URL`, `REVALIDATE_SECRET`.

## Code Style (Storefront)

Prettier config: no semicolons, double quotes, 2-space indent, trailing commas (ES5), `always` arrow parens.
