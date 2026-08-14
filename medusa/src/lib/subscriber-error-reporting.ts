import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { SubscriberArgs } from '@medusajs/medusa';
import { captureException } from './sentry';

/**
 * Envuelve el handler de un subscriber para que sus errores lleguen a Sentry.
 *
 * Medusa atrapa lo que lanza un subscriber y se limita a escribirlo en el log:
 * `event-bus-local` lo registra como `error` y `event-bus-redis` —el que corre
 * en producción— como `warn`. Nunca se convierte en una excepción no
 * capturada, así que los handlers globales que instala `instrumentation.js`
 * no la ven jamás.
 *
 * El agujero importa porque aquí viven los avisos de venta: si
 * `order-placed-merchant-notification` falla, el comerciante no se entera de
 * que ha vendido Y nadie se entera de que el aviso no salió. El mecanismo de
 * alerta fallaría en silencio, que es justo lo contrario de lo que se busca.
 *
 * El error se relanza siempre. El bus de Redis cuenta cuántos subscribers
 * fallan para decidir si reintenta el evento; tragárselo aquí le haría creer
 * que fue bien y anularía ese reintento.
 *
 * Sin `SENTRY_DSN` el capture es un no-op, así que en local y en los tests
 * esto no cambia nada salvo que el fallo se loguea como `error`.
 */
export function withErrorReporting<T>(
  handler: (args: SubscriberArgs<T>) => Promise<void>,
) {
  const wrapped = async function (args: SubscriberArgs<T>) {
    try {
      await handler(args);
    } catch (error) {
      captureException(error, {
        subscriber: handler.name,
        event: args.event.name,
        data: args.event.data,
      });

      // El bus de Redis solo escribe `warn`, que se pierde entre el ruido.
      // Dejarlo como `error` hace que se vea también en los logs de Coolify.
      const logger = args.container.resolve(ContainerRegistrationKeys.LOGGER);
      logger.error(
        `El subscriber "${handler.name}" falló procesando "${args.event.name}"`,
      );
      logger.error(error);

      throw error;
    }
  };

  // Medusa deriva el id del subscriber del NOMBRE de la función exportada. Sin
  // esta línea los seis subscribers se llamarían igual —el nombre de la función
  // de dentro de este wrapper— y el servidor no arranca:
  // "Subscriber with id ... already exists".
  Object.defineProperty(wrapped, 'name', { value: handler.name });

  return wrapped;
}
