import { getBaseURL } from "@lib/util/env"
import { brand } from "@lib/brand"
import { Metadata } from "next"
import { Mona_Sans } from "next/font/google"

import "../styles/globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  title: {
    default: brand.name,
    template: `%s | ${brand.name}`,
  },
  description: brand.description,
  openGraph: {
    type: "website",
    siteName: brand.name,
    images: [brand.defaultOgImage],
  },
}

const monaSans = Mona_Sans({
  preload: true,
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  weight: "variable",
  variable: "--font-mona-sans",
})

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="fr" data-mode="light" className="antialiased">
      {/* Sin <SpeedInsights />: solo funciona alojado en Vercel, porque envía
          los datos a /_vercel/insights, una ruta que inyecta su infraestructura.
          Desplegamos en Coolify sobre un VPS, así que ahí no existe y cada carga
          de página pedía un script que devolvía 404. */}
      <body className={`${monaSans.className}`}>
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}
