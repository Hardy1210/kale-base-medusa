import { sdk } from "@lib/config"
import { CONFIG_TTL } from "@lib/cache-tags"
import { HttpTypes } from "@medusajs/types"

// Shipping actions
export const listCartShippingMethods = async function (cartId: string) {
  return sdk.client
    .fetch<HttpTypes.StoreShippingOptionListResponse>(
      `/store/shipping-options`,
      {
        query: { cart_id: cartId },
        next: { revalidate: CONFIG_TTL, tags: ["shipping"] },
      }
    )
    .then(({ shipping_options }) => shipping_options)
    .catch(() => {
      return null
    })
}
