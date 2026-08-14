import * as Sentry from "@sentry/nextjs"

// Next carga este fichero en el navegador antes de hidratar la página (soportado
// desde Next 15.3). Cubre lo que el servidor no puede ver: errores de
// hidratación, fallos al montar el formulario de Stripe, excepciones en los
// handlers de eventos del carrito.
//
// El DSN va en una variable NEXT_PUBLIC_ porque tiene que viajar al bundle del
// cliente. No es un secreto: un DSN solo permite ENVIAR eventos al proyecto,
// nunca leerlos, y por eso Sentry los publica en el HTML de todos sus ejemplos.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0,
  })
}

// Necesario para que Sentry pueda medir y reportar los errores de navegación
// del App Router.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
