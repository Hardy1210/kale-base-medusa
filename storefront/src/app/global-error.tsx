"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

import "../styles/globals.css"

// Última red de seguridad del storefront: Next renderiza este componente cuando
// el error ocurre en el layout raíz, el único sitio que ningún `error.tsx` de
// segmento puede capturar. Sustituye al layout entero, por eso tiene que pintar
// su propio <html> e importar la hoja de estilos por su cuenta.
//
// El `captureException` es imprescindible: los errores de renderizado en el
// cliente no pasan por `onRequestError` del servidor, así que sin esto la
// pantalla rota del comprador no dejaría ni rastro en Sentry.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="fr" data-mode="light" className="antialiased">
      <body>
        <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
          <h1 className="text-xl md:text-3xl text-black">
            Something went wrong
          </h1>
          <p className="md:text-md max-w-md text-black">
            An unexpected error occurred. Try again, or head over to our home
            page.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              type="button"
              onClick={reset}
              className="border border-black px-6 py-3 text-black"
            >
              Try again
            </button>
            {/* <a> y no <Link> a propósito: si el layout raíz ha reventado, una
                navegación de cliente conservaría el estado roto. Aquí interesa
                una recarga completa. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="border border-black px-6 py-3 text-black">
              Back to home
            </a>
          </div>
        </main>
      </body>
    </html>
  )
}
