// Medusa busca este archivo en la raíz del proyecto al arrancar y, si exporta
// una función `register`, la ejecuta ANTES de levantar el servidor
// (ver `registerInstrumentation` en @medusajs/medusa).
//
// Lo usamos para arrancar Sentry. Tiene que ser aquí y no dentro de `src/`:
// `Sentry.init()` es lo que instala los handlers de excepciones NO capturadas,
// así que si se llamara de forma perezosa —la primera vez que algo falla— un
// crash del proceso antes de ese momento no llegaría nunca a Sentry.
//
// Sin SENTRY_DSN no hace nada, así que en local y en los tests no requiere
// configuración alguna.

const Sentry = require('@sentry/node');

exports.register = function register() {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    // Solo nos interesan los errores, no el performance monitoring: así el
    // plan gratuito de Sentry se gasta únicamente en lo que hay que vigilar.
    tracesSampleRate: 0,
  });
};

// ─────────────────────────────────────────────────────────────────────────
// OpenTelemetry — desactivado.
// Para activar trazas (ver https://docs.medusajs.com/learn/debugging-and-testing/instrumentation)
// instala los paquetes de OTel y añade la llamada a `registerOtel` dentro de
// la función `register` de arriba.
// ─────────────────────────────────────────────────────────────────────────
