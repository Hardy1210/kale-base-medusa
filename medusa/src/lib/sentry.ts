import * as Sentry from '@sentry/node';

let initialized = false;

function init() {
  if (initialized) {
    return;
  }

  initialized = true;

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
}

/**
 * Reporta un error a Sentry.
 *
 * Hace falta llamarla explícitamente porque el SDK solo engancha las
 * excepciones NO capturadas. Los errores que atrapamos y no relanzamos —el
 * caso típico es un envío de email fallido— nunca llegarían a Sentry por sí
 * solos y se quedarían únicamente en el log del servidor.
 *
 * Sin SENTRY_DSN definida es un no-op, así que en local y en los tests no
 * requiere configuración alguna.
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
) {
  init();

  if (!process.env.SENTRY_DSN) {
    return;
  }

  Sentry.captureException(error, context ? { extra: context } : undefined);
}
