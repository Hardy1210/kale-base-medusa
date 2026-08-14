import { defineMiddlewares } from '@medusajs/medusa';
import { adminProductTypeRoutesMiddlewares } from './store/custom/product-types/middlewares';
import { authenticate, errorHandler } from '@medusajs/framework';
import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { captureException } from '../lib/sentry';

// Manejador de errores por defecto de Medusa: traduce la excepción a su código
// HTTP y escribe la respuesta. Se reutiliza tal cual para no reimplementar el
// mapeo de tipos de error a status, que es largo y cambia entre versiones.
const medusaErrorHandler = errorHandler();

/**
 * Reporta a Sentry los errores que acaban en 5xx.
 *
 * Medusa intercepta lo que lanza cualquier ruta y lo convierte en respuesta
 * HTTP, así que nunca llega a los handlers de excepciones no capturadas: sin
 * esto, `/store/carts/:id/complete` puede estar devolviendo 500 a todos los
 * compradores y el dashboard de Sentry seguiría vacío.
 *
 * Se delega primero y se mira `res.statusCode` después, en vez de clasificar
 * el error por nuestra cuenta. El manejador de Medusa es síncrono, así que
 * para cuando vuelve ya ha fijado el status, y de este modo el criterio de
 * "esto es un fallo del servidor" es exactamente el suyo. Los 4xx (validación,
 * 404, no autorizado) no se reportan: son ruido, no averías.
 */
function reportingErrorHandler(
  error: any,
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  medusaErrorHandler(error, req, res, next);

  if (res.statusCode >= 500) {
    captureException(error, {
      path: req.path,
      method: req.method,
      statusCode: res.statusCode,
    });
  }
}

export default defineMiddlewares({
  routes: [
    ...adminProductTypeRoutesMiddlewares,
    {
      method: 'ALL',
      matcher: '/store/custom/customer/*',
      middlewares: [authenticate('customer', ['session', 'bearer'])],
    },
  ],
  errorHandler: reportingErrorHandler,
});
