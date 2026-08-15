# syntax=docker/dockerfile:1

# Imagen de producción del backend Medusa.
#
# Se usa Debian slim y no Alpine: varias dependencias del stack traen binarios
# precompilados para glibc, y con musl hay que recompilarlas. En un servidor que
# además compila la app en cada despliegue, esos minutos extra y esos fallos
# intermitentes no compensan los ~40 MB que ahorraría Alpine.
#
# Node 22 porque la rama 20 dejó de recibir soporte en abril de 2026.

# ─────────────────────────────── build ───────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app
RUN corepack enable

# Las dependencias se copian solas primero para que Docker reutilice la capa
# mientras no cambien: sin esto, cada cambio en src/ reinstalaría todo.
COPY package.json yarn.lock .yarnrc.yml .npmrc ./
RUN yarn install --immutable

COPY . .

# `medusa build` deja en .medusa/server una aplicación autónoma: su propio
# package.json, el código compilado y el admin ya construido en public/.
RUN yarn build

# La instalación de la app compilada se hace AQUÍ, en el builder, y no en la
# imagen final. Así se aprovecha la caché de Yarn que ya está caliente y la
# etapa de runtime no necesita red ni gestor de paquetes.
WORKDIR /app/.medusa/server
RUN yarn install

# ────────────────────────────── runtime ──────────────────────────────
FROM node:22-slim AS runner

WORKDIR /app

# Se fija aquí, y no solo en Coolify, para que el contenedor sea seguro por
# defecto: de NODE_ENV depende que medusa-config.js rechace arrancar con
# secretos de firma débiles. El CLI de Medusa asume "development" si falta.
ENV NODE_ENV=production
ENV PORT=9000

# Aquí no se habilita corepack: la imagen final no instala nada ni usa yarn,
# arranca el binario que ya trae node_modules.

# `node` viene creado en la imagen oficial. Ejecutar como usuario sin
# privilegios evita que un fallo en la app se traduzca en root dentro del
# contenedor.
COPY --from=builder --chown=node:node /app/.medusa/server ./

USER node

EXPOSE 9000

# Sirve la API de tienda, la de admin y el panel en /app.
#
# Se llama al binario directamente en vez de a `yarn start`. Con yarn, corepack
# intenta DESCARGARSE yarn 4.7.0 en cada arranque del contenedor —necesitaría
# red para encender la tienda— y además da un falso "the project doesn't seem to
# have been installed": la instalación se hizo en .medusa/server dentro del
# builder y yarn no reconoce su propio estado tras copiarla a /app.
#
# Las migraciones NO se ejecutan aquí a propósito: son irreversibles y no deben
# dispararse solas en cada reinicio o escalado del contenedor. Se lanzan una vez
# por despliegue desde el Release Command de Coolify, que es un paso aparte del
# arranque:
#
#   ./node_modules/.bin/medusa db:migrate
#
# Ruta directa al binario, no `yarn medusa db:migrate`: aquí arriba no se
# habilita corepack, así que `yarn` sería el yarn 1 global de la imagen base y
# no el 4.7.0 del proyecto. Detalle en PRODUCTION_DEPLOY.md §2.
CMD ["./node_modules/.bin/medusa", "start"]
