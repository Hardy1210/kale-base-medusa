import * as Sentry from '@sentry/node';

/**
 * Reporta un error a Sentry.
 *
 * El SDK se arranca en `instrumentation.js` (raíz del proyecto), que Medusa
 * ejecuta antes de levantar el servidor. Aquí NO se inicializa nada: si se
 * hiciera de forma perezosa, los handlers de excepciones no capturadas no
 * estarían instalados hasta la primera llamada y un crash del proceso no
 * llegaría nunca a Sentry.
 *
 * Esta función es para los errores que SÍ atrapamos y no relanzamos —el caso
 * típico es un envío de email fallido—, que por definición no pasan por los
 * handlers globales y se quedarían solo en el log del servidor.
 *
 * Sin SENTRY_DSN es un no-op, así que en local y en los tests no requiere
 * configuración alguna.
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
) {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  Sentry.captureException(error, context ? { extra: context } : undefined);
}
