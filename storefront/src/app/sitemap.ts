import { MetadataRoute } from "next"
import { sdk } from "@lib/config"
import { getCollectionsList } from "@lib/data/collections"
import { brand } from "@lib/brand"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = brand.url

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/fr`,        changeFrequency: "weekly",  priority: 1.0 },
    { url: `${base}/fr/store`,  changeFrequency: "daily",   priority: 0.9 },
    { url: `${base}/fr/about`,  changeFrequency: "monthly", priority: 0.5 },
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
        url: `${base}/fr/products/${p.handle}`,
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
        url: `${base}/fr/collections/${c.handle}`,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }))
  } catch {
    // Medusa no disponible en build time — colecciones omitidas del sitemap
  }

  return [...staticPages, ...productPages, ...collectionPages]
}
