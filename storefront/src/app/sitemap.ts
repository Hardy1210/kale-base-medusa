import { MetadataRoute } from "next"
import { sdk } from "@lib/config"
import { getCollectionsList } from "@lib/data/collections"
import { brand } from "@lib/brand"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = brand.url

  // El prefijo de país estaba escrito a mano como "fr". Para un cliente que no
  // vendiera en Francia, el sitemap enviado a Search Console apuntaba a URLs de
  // otro país: todas 404 o redirigidas, y el catálogo sin indexar. Se lee de la
  // misma variable que usa el middleware para decidir la región por defecto, así
  // que cambiar de país no requiere tocar este archivo.
  const region = process.env.NEXT_PUBLIC_DEFAULT_REGION || "fr"

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/${region}`,               changeFrequency: "weekly",  priority: 1.0 },
    { url: `${base}/${region}/store`,         changeFrequency: "daily",   priority: 0.9 },
    { url: `${base}/${region}/about`,         changeFrequency: "monthly", priority: 0.5 },
    // Las legales son obligatorias en la UE y Google las valora como señal de
    // confianza. Estaban fuera del sitemap sin motivo.
    { url: `${base}/${region}/privacy-policy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/${region}/terms-of-use`,   changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/${region}/cookie-policy`,  changeFrequency: "yearly", priority: 0.3 },
  ]

  let productPages: MetadataRoute.Sitemap = []
  try {
    const { products } = await sdk.store.product.list(
      { fields: "handle", limit: 1000 },
      { next: { tags: ["products"] } }
    )
    productPages = products
      .filter((p): p is typeof p & { handle: string } => Boolean(p.handle))
      .map((p) => ({
        url: `${base}/${region}/products/${p.handle}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }))
  } catch {
    // Medusa no disponible en build time — productos omitidos del sitemap
  }

  let collectionPages: MetadataRoute.Sitemap = []
  try {
    const { collections } = await getCollectionsList(0, 100)
    collectionPages = collections
      .filter((c): c is typeof c & { handle: string } => Boolean(c.handle))
      .map((c) => ({
        url: `${base}/${region}/collections/${c.handle}`,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }))
  } catch {
    // Medusa no disponible en build time — colecciones omitidas del sitemap
  }

  return [...staticPages, ...productPages, ...collectionPages]
}
