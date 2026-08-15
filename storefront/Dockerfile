# syntax=docker/dockerfile:1

# Imagen de producción del storefront Next.js.
#
# Debian slim y no Alpine, sobre todo por `sharp`: es quien redimensiona las
# fotos de producto en /_next/image y con musl da problemas de binarios. Es el
# mayor consumo de CPU del servidor, no el sitio donde ahorrar 40 MB.
#
# Node 22 porque la rama 20 dejó de recibir soporte en abril de 2026.

# ─────────────────────────────── build ───────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

# Las NEXT_PUBLIC_* se incrustan en el JavaScript que se descarga el navegador,
# así que tienen que existir AL COMPILAR, no al arrancar. Por eso son build args
# y no variables de entorno del contenedor: pasarlas solo en runtime deja la
# tienda apuntando a undefined.
# En Coolify hay que marcarlas también como Build Args.
ARG NEXT_PUBLIC_MEDUSA_BACKEND_URL
ARG NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_DEFAULT_REGION
ARG NEXT_PUBLIC_STRIPE_KEY
ARG NEXT_PUBLIC_PAYPAL_CLIENT_ID
ARG NEXT_PUBLIC_INSTAGRAM_URL
ARG NEXT_PUBLIC_FACEBOOK_URL
ARG NEXT_PUBLIC_TIKTOK_URL
ARG NEXT_PUBLIC_PINTEREST_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_FEATURE_SEARCH_ENABLED
ARG REVALIDATE_SECRET

ENV NEXT_PUBLIC_MEDUSA_BACKEND_URL=$NEXT_PUBLIC_MEDUSA_BACKEND_URL
ENV NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=$NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_DEFAULT_REGION=$NEXT_PUBLIC_DEFAULT_REGION
ENV NEXT_PUBLIC_STRIPE_KEY=$NEXT_PUBLIC_STRIPE_KEY
ENV NEXT_PUBLIC_PAYPAL_CLIENT_ID=$NEXT_PUBLIC_PAYPAL_CLIENT_ID
ENV NEXT_PUBLIC_INSTAGRAM_URL=$NEXT_PUBLIC_INSTAGRAM_URL
ENV NEXT_PUBLIC_FACEBOOK_URL=$NEXT_PUBLIC_FACEBOOK_URL
ENV NEXT_PUBLIC_TIKTOK_URL=$NEXT_PUBLIC_TIKTOK_URL
ENV NEXT_PUBLIC_PINTEREST_URL=$NEXT_PUBLIC_PINTEREST_URL
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_FEATURE_SEARCH_ENABLED=$NEXT_PUBLIC_FEATURE_SEARCH_ENABLED
ENV REVALIDATE_SECRET=$REVALIDATE_SECRET

# Capa aparte para las dependencias: mientras no cambien, Docker no reinstala.
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

# `check-env-variables.js` corre al cargar next.config.js y aborta el build si
# falta alguna NEXT_PUBLIC_ obligatoria. Es deliberado: mejor que reviente aquí
# y no que la tienda arranque apuntando a ninguna parte.
RUN yarn build

# ────────────────────────────── runtime ──────────────────────────────
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000
# Sin esto Next escucha solo en localhost y el contenedor queda inalcanzable
# desde el proxy de Coolify.
ENV HOSTNAME=0.0.0.0

# La salida standalone trae su propio servidor y solo las dependencias que el
# build ha rastreado como necesarias. Los estáticos y public/ van aparte porque
# Next no los incluye ahí.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node

EXPOSE 8000

# server.js lo genera el propio build de Next. No se usa `yarn start` porque
# en modo standalone no hay node_modules donde vivan los binarios de Next.
CMD ["node", "server.js"]
