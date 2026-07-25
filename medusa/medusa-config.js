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
              siteTitle: 'Mi Tienda',
              companyName: 'Mi Tienda',
              footerLinks: [
                {
                  url: 'https://tutienda.com',
                  label: 'Mi Tienda',
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
          //     siteTitle: 'Mi Tienda',
          //     companyName: 'Mi Tienda',
          //     footerLinks: [
          //       {
          //         url: 'https://tutienda.com',
          //         label: 'Mi Tienda',
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
