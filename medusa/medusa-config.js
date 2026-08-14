const { loadEnv, defineConfig } = require('@medusajs/framework/utils');

loadEnv(process.env.NODE_ENV, process.cwd());

module.exports = defineConfig({
  admin: {
    backendUrl:
      process.env.BACKEND_URL ?? 'http://localhost:9000',
    storefrontUrl: process.env.STOREFRONT_URL,
  },
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS,
      adminCors: process.env.ADMIN_CORS,
      authCors: process.env.AUTH_CORS,
      jwtSecret: process.env.JWT_SECRET || 'supersecret',
      cookieSecret: process.env.COOKIE_SECRET || 'supersecret',
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    },
  },
  modules: [
    // ─────────────────────────────────────────────────────────────────────
    // INFRAESTRUCTURA EN REDIS
    //
    // Sin estos tres módulos Medusa usa versiones "in-memory" y arranca igual,
    // pero con dos problemas serios en producción:
    //
    //   1. El bus de eventos no tiene cola ni reintentos. Si el proceso se
    //      reinicia entre el cobro y el envío de los emails (un deploy, un
    //      pico, un fallo), el evento se pierde para siempre: pedido cobrado
    //      y el comerciante sin enterarse. A poco volumen es MÁS grave, no
    //      menos: perder 1 pedido de 20 es el 5 % del mes.
    //   2. La caché vive en el heap de Node, así que el consumo de memoria del
    //      proceso crece con los días de uptime en lugar de mantenerse plano.
    //
    // Requieren REDIS_URL. Si falta, el arranque falla — y es lo que queremos:
    // más vale un error ruidoso que una caída silenciosa a memoria volátil.
    // Redis ya está en el stack (docker-compose en local, servicio de Coolify
    // en producción); esto solo lo aprovecha.
    // ─────────────────────────────────────────────────────────────────────
    {
      resolve: '@medusajs/medusa/cache-redis',
      options: {
        redisUrl: process.env.REDIS_URL,
      },
    },
    {
      resolve: '@medusajs/medusa/event-bus-redis',
      options: {
        redisUrl: process.env.REDIS_URL,
      },
    },
    {
      // Ojo: este módulo espera la URL ANIDADA en `redis.url`, no en
      // `redisUrl` como los dos de arriba. Es así en el paquete, no es un
      // despiste.
      resolve: '@medusajs/medusa/workflow-engine-redis',
      options: {
        redis: {
          url: process.env.REDIS_URL,
        },
      },
    },
    {
      resolve: '@medusajs/medusa/payment',
      options: {
        providers: [
          {
            id: 'stripe',
            resolve: '@medusajs/medusa/payment-stripe',
            options: {
              apiKey: process.env.STRIPE_API_KEY,
              webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
            },
          },
        ],
      },
    },
    {
      resolve: './src/modules/fashion',
    },
    {
      resolve: '@medusajs/medusa/file',
      options: {
        providers: [
          {
            resolve: '@medusajs/medusa/file-s3',
            id: 's3',
            options: {
              file_url: process.env.S3_FILE_URL,
              access_key_id: process.env.S3_ACCESS_KEY_ID,
              secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
              region: process.env.S3_REGION,
              bucket: process.env.S3_BUCKET,
              endpoint: process.env.S3_ENDPOINT,
              additional_client_config: {
                forcePathStyle:
                  process.env.S3_FORCE_PATH_STYLE === 'true' ? true : undefined,
              },
            },
          },
        ],
      },
    },
    {
      resolve: '@medusajs/medusa/notification',
      options: {
        providers: [
          {
            // Canal "feed": notificaciones dentro del admin (export/import de
            // productos, etc.). Sin este proveedor, esas acciones fallan.
            resolve: '@medusajs/medusa/notification-local',
            id: 'local',
            options: {
              channels: ['feed'],
            },
          },
          {
            resolve: './src/modules/resend',
            id: 'resend',
            options: {
              channels: ['email'],
              api_key: process.env.RESEND_API_KEY,
              from: process.env.RESEND_FROM,
              // Reply-To: las respuestas de los clientes van a contact@ (via .env)
              replyTo: process.env.EMAIL_REPLY_TO,
              // ── Marca en los emails ────────────────────────────────────
              // Se configura por cliente en el .env (STORE_NAME). Estos
              // valores llegan a TODAS las plantillas como props; no hay que
              // tocar ningún .tsx para cambiar el nombre de la tienda.
              siteTitle: process.env.STORE_NAME || 'Mi Tienda',
              companyName: process.env.STORE_NAME || 'Mi Tienda',
              contactEmail: process.env.EMAIL_REPLY_TO,
              footerLinks: [
                {
                  url: process.env.STOREFRONT_URL || 'https://tutienda.com',
                  label: process.env.STORE_NAME || 'Mi Tienda',
                },
              ],
            },
          },
          // ───────────────────────────────────────────────────────────────
          // Brevo — INACTIVO. Para migrar de Resend a Brevo en el canal
          // "email": comenta el proveedor 'resend' de arriba, descomenta este
          // bloque y define BREVO_API_KEY + BREVO_FROM en el .env. Las
          // plantillas y los subscribers NO cambian (misma fuente de verdad).
          // {
          //   resolve: './src/modules/brevo',
          //   id: 'brevo',
          //   options: {
          //     channels: ['email'],
          //     api_key: process.env.BREVO_API_KEY,
          //     from: process.env.BREVO_FROM,
          //     replyTo: process.env.EMAIL_REPLY_TO,
          //     siteTitle: process.env.STORE_NAME || 'Mi Tienda',
          //     companyName: process.env.STORE_NAME || 'Mi Tienda',
          //     contactEmail: process.env.EMAIL_REPLY_TO,
          //     footerLinks: [
          //       {
          //         url: process.env.STOREFRONT_URL || 'https://tutienda.com',
          //         label: process.env.STORE_NAME || 'Mi Tienda',
          //       },
          //     ],
          //   },
          // },
        ],
      },
    },
  ],
  plugins: [
    {
      resolve: '@agilo/medusa-analytics-plugin',
      options: {},
    },
  ],
});
