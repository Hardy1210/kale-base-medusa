import { sdk } from "@lib/config"
import { CONFIG_TTL } from "@lib/cache-tags"
import { HttpTypes } from "@medusajs/types"

// Shipping actions
export const listCartPaymentMethods = async function (regionId: string) {
  return sdk.client
    .fetch<HttpTypes.StorePaymentProviderListResponse>(
      `/store/payment-providers`,
      {
        query: { region_id: regionId },
        next: { revalidate: CONFIG_TTL, tags: ["payment_providers"] },
      }
    )
    .then(({ payment_providers }) => payment_providers)
    .catch(() => {
      return null
    })
}
