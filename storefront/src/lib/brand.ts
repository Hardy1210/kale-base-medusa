// CONFIGURACIÓN DE MARCA — editar para cada cliente nuevo
// ─────────────────────────────────────────────────────────────────────────────
// Este archivo es la única fuente de verdad para nombre, descripciones y
// textos SEO del storefront. Todos los títulos y metadata se generan desde aquí.
// ─────────────────────────────────────────────────────────────────────────────

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:8000"

export const brand = {
  // Nombre visible en titles, footer, emails y JSON-LD
  name: "Mi Tienda",

  // Descripción por defecto (og:description, metadescription global)
  description:
    "Explora nuestra tienda online con los mejores productos. Envío rápido y seguro.",

  // URL base del storefront (se lee de NEXT_PUBLIC_BASE_URL)
  url: baseUrl,

  // Imagen por defecto para og:image — colocar en /public/images/og-default.jpg
  defaultOgImage: `${baseUrl}/images/og-default.jpg`,

  // Textos por página — solo los valores que cambian por cliente
  pages: {
    home: {
      title: "Mi Tienda",
      description:
        "Descubre nuestra colección de productos. Envío rápido y seguro.",
    },
    store: {
      title: "Tienda",
      description: "Explora todos nuestros productos.",
    },
    about: {
      title: "Sobre nosotros",
      description: "Conoce más sobre nosotros, nuestra misión y valores.",
    },
  },

  // Placeholders para Organization JSON-LD
  // TODO: completar antes de activar en layout.tsx (ver CLIENT_SETUP.md)
  organization: {
    name: "Mi Tienda",                          // TODO: nombre legal de la empresa
    url: baseUrl,                               // TODO: URL pública en producción
    logo: `${baseUrl}/images/logo.png`,         // TODO: ruta al logo en /public
    description: "Descripción de la empresa para Google Knowledge Graph.", // TODO
  },
}
