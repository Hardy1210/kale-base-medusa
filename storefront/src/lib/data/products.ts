import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getRegion } from "@lib/data/regions"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { sortProducts } from "@lib/util/sort-products"
import { CACHE_TAGS, CATALOG_TTL, STOCK_TTL } from "@lib/cache-tags"

type VariantStock = Pick<
  HttpTypes.StoreProductVariant,
  "manage_inventory" | "inventory_quantity"
>

/**
 * Stock de las variantes, en una petición aparte del catálogo y con un TTL
 * corto. Así las ventas no tienen que invalidar la caché del catálogo.
 *
 * Medusa solo calcula `inventory_quantity` si se pide también
 * `variants.manage_inventory`.
 */
export const getVariantsStock = async function (
  productIds: string[]
): Promise<Map<string, VariantStock>> {
  const stock = new Map<string, VariantStock>()

  if (!productIds.length) {
    return stock
  }

  const { products } = await sdk.client.fetch<{
    products: HttpTypes.StoreProduct[]
  }>(`/store/products`, {
    query: {
      id: productIds,
      limit: productIds.length,
      fields:
        "id,variants.id,variants.manage_inventory,+variants.inventory_quantity",
    },
    next: { revalidate: STOCK_TTL },
  })

  for (const product of products) {
    for (const variant of product.variants ?? []) {
      stock.set(variant.id, {
        manage_inventory: variant.manage_inventory,
        inventory_quantity: variant.inventory_quantity,
      })
    }
  }

  return stock
}

function withStock(
  products: HttpTypes.StoreProduct[],
  stock: Map<string, VariantStock>
): HttpTypes.StoreProduct[] {
  return products.map((product) => ({
    ...product,
    variants:
      product.variants?.map((variant) => ({
        ...variant,
        ...stock.get(variant.id),
      })) ?? null,
  }))
}

/**
 * Productos por id, con precios y stock. Lo usan las acciones de la ficha y
 * los artículos del carrito, que necesitan la cantidad disponible.
 */
export const getProductsById = async function ({
  ids,
  regionId,
}: {
  ids: string[]
  regionId: string
}) {
  const [{ products }, stock] = await Promise.all([
    sdk.client.fetch<{ products: HttpTypes.StoreProduct[] }>(
      `/store/products`,
      {
        query: {
          id: ids,
          region_id: regionId,
          fields: "*variants.calculated_price",
        },
        next: { revalidate: CATALOG_TTL, tags: ids.map(CACHE_TAGS.product) },
      }
    ),
    getVariantsStock(ids),
  ])

  return withStock(products, stock)
}

/**
 * Ficha de producto, sin stock: quien lo necesite lo pide con
 * `getVariantsStock`.
 */
export const getProductByHandle = async function (
  handle: string,
  regionId: string
) {
  return sdk.client
    .fetch<{ products: HttpTypes.StoreProduct[] }>(`/store/products`, {
      query: {
        handle,
        region_id: regionId,
        fields: "*variants.calculated_price",
      },
      next: {
        revalidate: CATALOG_TTL,
        tags: [CACHE_TAGS.productHandle(handle)],
      },
    })
    .then(({ products }) => products[0])
}

// Un cambio de material o color afecta a todas las fichas (`fashion`); uno en
// las variantes del producto, solo a la suya (`product-handle:<handle>`).
export const getProductFashionDataByHandle = async function (handle: string) {
  return sdk.client.fetch<{
    materials: {
      id: string
      name: string
      colors: {
        id: string
        name: string
        hex_code: string
      }[]
    }[]
  }>(`/store/custom/fashion/${handle}`, {
    method: "GET",
    next: {
      revalidate: CATALOG_TTL,
      tags: [CACHE_TAGS.fashion, CACHE_TAGS.productHandle(handle)],
    },
  })
}

export const getProductsList = async function ({
  pageParam = 1,
  queryParams,
  countryCode,
}: {
  pageParam?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
  countryCode: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
}> {
  const page = Math.max(1, pageParam || 1)
  const limit = queryParams?.limit || 12
  const offset = (page - 1) * limit
  const region = await getRegion(countryCode)

  if (!region) {
    return {
      response: { products: [], count: 0 },
      nextPage: null,
    }
  }
  return sdk.client
    .fetch<{ products: HttpTypes.StoreProduct[]; count: number }>(
      `/store/products`,
      {
        query: {
          limit,
          offset,
          region_id: region.id,
          fields: "*variants.calculated_price",
          ...queryParams,
        },
        next: { revalidate: CATALOG_TTL, tags: [CACHE_TAGS.products] },
      }
    )
    .then(({ products, count }) => {
      const nextPage = count > offset + limit ? page + 1 : null

      return {
        response: {
          products,
          count,
        },
        nextPage: nextPage,
        queryParams,
      }
    })
}

/**
 * This will fetch 100 products to the Next.js cache and sort them based on the sortBy parameter.
 * It will then return the paginated products based on the page and limit parameters.
 */
export const getProductsListWithSort = async function ({
  page = 0,
  queryParams,
  sortBy = "created_at",
  countryCode,
}: {
  page?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
  sortBy?: SortOptions
  countryCode: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
}> {
  const limit = queryParams?.limit || 12

  const {
    response: { products, count },
  } = await getProductsList({
    pageParam: 0,
    queryParams: {
      ...queryParams,
      limit: 100,
    },
    countryCode,
  })

  const sortedProducts = sortProducts(products, sortBy)

  const pageParam = (page - 1) * limit

  const nextPage = count > pageParam + limit ? pageParam + limit : null

  const paginatedProducts = sortedProducts.slice(pageParam, pageParam + limit)

  return {
    response: {
      products: paginatedProducts,
      count,
    },
    nextPage,
    queryParams,
  }
}

/**
 * Search products using Medusa's native search (q parameter)
 */
export const searchProducts = async function ({
  q,
  countryCode,
  limit = 12,
  offset = 0,
}: {
  q: string
  countryCode: string
  limit?: number
  offset?: number
}): Promise<{ products: HttpTypes.StoreProduct[]; count: number }> {
  const region = await getRegion(countryCode)

  if (!region) {
    return { products: [], count: 0 }
  }

  return sdk.client
    .fetch<{ products: HttpTypes.StoreProduct[]; count: number }>(
      `/store/products`,
      {
        query: {
          q,
          limit,
          offset,
          region_id: region.id,
          fields: "*variants.calculated_price",
        },
        next: { tags: [CACHE_TAGS.products] },
      }
    )
    .then(({ products, count }) => ({ products, count }))
}
