import * as Sentry from "@sentry/nextjs"

// Next ejecuta `register()` una sola vez al arrancar el servidor, antes de
// atender la primera petición. Es el equivalente en el storefront a
// `medusa/instrumentation.js`: inicializar aquí y no de forma perezosa es lo
// que garantiza que un fallo temprano también se reporte.
//
// Sin NEXT_PUBLIC_SENTRY_DSN no hace nada, así que en local y en CI no
// requiere configuración alguna.
export async function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return
  }

  // Este fichero lo carga tanto el runtime de Node como el de Edge. El
  // middleware de países corre en Edge, así que ambos importan.
  if (
    process.env.NEXT_RUNTIME === "nodejs" ||
    process.env.NEXT_RUNTIME === "edge"
  ) {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      // Igual que en el backend: solo errores, nada de performance. Así el
      // plan gratuito se gasta únicamente en lo que hay que vigilar.
      tracesSampleRate: 0,
    })
  }
}

// Hook de Next 15: recibe los errores lanzados en Server Components, route
// handlers y server actions. Sin esto, un fallo al renderizar la ficha de
// producto o al completar el carrito solo saldría en los logs del contenedor.
export const onRequestError = Sentry.captureRequestError
