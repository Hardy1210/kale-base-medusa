# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- **PostgreSQL 16** — port 5433 (non-standard to avoid conflicts)
- **Redis 7** — port 6379
- **MinIO** — S3-compatible storage, API on 9000, Console on 9001

## Medusa Config Highlights (`medusa/medusa-config.js`)
- **Payment:** Stripe
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

GitHub Actions runs on PRs to `master` that touch `storefront/**`. It runs `yarn lint` against Node 20.x and 22.x. Required secrets: `BACKEND_URL`, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`, `STRIPE_KEY`, `REVALIDATE_SECRET`.

## Code Style (Storefront)

Prettier config: no semicolons, double quotes, 2-space indent, trailing commas (ES5), `always` arrow parens.
