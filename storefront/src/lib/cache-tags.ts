// Etiquetas de la caché de datos de Next. Son el contrato con el subscriber
// de Medusa (`medusa/src/subscribers/revalidate-storefront.ts`), que las
// invalida vía POST /api/revalidate cuando algo cambia en el admin.
//
// Regla: una ficha lleva solo su etiqueta granular; las etiquetas de lista
// van solo en los listados. Así editar un producto no tira la caché de todas
// las fichas, y los listados que lo muestran se invalidan con `products`.

export const CACHE_TAGS = {
  products: "products",
  collections: "collections",
  categories: "categories",
  productTypes: "product-types",
  fashion: "fashion",
  product: (id: string) => `product:${id}`,
  productHandle: (handle: string) => `product-handle:${handle}`,
  collection: (id: string) => `collection:${id}`,
  collectionHandle: (handle: string) => `collection-handle:${handle}`,
} as const

// Red de seguridad del catálogo (segundos). Cubre lo que no emite eventos,
// como las listas de precios, y cualquier aviso que se haya perdido.
export const CATALOG_TTL = 300

// El stock va aparte y con un TTL corto: las ventas no invalidan el catálogo.
export const STOCK_TTL = 30

// Datos que casi nunca cambian y que ningún evento invalida.
export const CONFIG_TTL = 3600

const LIST_TAGS = new Set<string>([
  CACHE_TAGS.products,
  CACHE_TAGS.collections,
  CACHE_TAGS.categories,
  CACHE_TAGS.productTypes,
  CACHE_TAGS.fashion,
])

// ids de Medusa (prod_…, pcol_…) y handles: minúsculas, dígitos, _ y -.
const GRANULAR_TAG =
  /^(product|product-handle|collection|collection-handle):[A-Za-z0-9_-]{1,200}$/

// Lista cerrada: /api/revalidate solo acepta etiquetas del catálogo, nunca
// `cart`, `customer` ni otras que pudieran tocar datos de sesión.
export function isRevalidatableTag(tag: unknown): tag is string {
  return (
    typeof tag === "string" && (LIST_TAGS.has(tag) || GRANULAR_TAG.test(tag))
  )
}
