import { sdk } from "@lib/config"
import { CACHE_TAGS, CATALOG_TTL } from "@lib/cache-tags"
import { HttpTypes } from "@medusajs/types"

export const listCategories = async function () {
  return sdk.client
    .fetch<{ product_categories: HttpTypes.StoreProductCategory[] }>(
      "/store/product-categories",
      {
        query: { fields: "+category_children" },
        next: { revalidate: CATALOG_TTL, tags: [CACHE_TAGS.categories] },
      }
    )
    .then(({ product_categories }) => product_categories)
}

export const getCategoriesList = async function (
  offset: number = 0,
  limit: number = 100,
  fields?: (keyof HttpTypes.StoreProductCategory)[]
) {
  return sdk.client.fetch<{
    product_categories: HttpTypes.StoreProductCategory[]
  }>("/store/product-categories", {
    query: {
      limit,
      offset,
      fields: fields ? fields.join(",") : undefined,
    },
    next: { revalidate: CATALOG_TTL, tags: [CACHE_TAGS.categories] },
  })
}

export const getCategoryByHandle = async function (categoryHandle: string[]) {
  return sdk.client.fetch<HttpTypes.StoreProductCategoryListResponse>(
    `/store/product-categories`,
    {
      query: { handle: categoryHandle },
      next: { revalidate: CATALOG_TTL, tags: [CACHE_TAGS.categories] },
    }
  )
}
