import { Metadata } from "next"
import { notFound } from "next/navigation"

import { sdk } from "@lib/config"
import { getRegion, listRegions } from "@lib/data/regions"
import {
  getProductByHandle,
  getProductFashionDataByHandle,
} from "@lib/data/products"
import { brand } from "@lib/brand"
import ProductTemplate from "@modules/products/templates"

type Props = {
  params: Promise<{ countryCode: string; handle: string }>
}

export async function generateStaticParams() {
  try {
    const countryCodes = await listRegions().then(
      (regions) =>
        regions
          ?.map((r) => r.countries?.map((c) => c.iso_2))
          .flat()
          .filter(Boolean) as string[]
    )

    if (!countryCodes) {
      return []
    }

    const { products } = await sdk.store.product.list(
      { fields: "handle" },
      { next: { tags: ["products"] } }
    )

    const staticParams = countryCodes
      ?.map((countryCode) =>
        products.map((product) => ({
          countryCode,
          handle: product.handle,
        }))
      )
      .flat()
      .filter((product) => product.handle)

    return staticParams
  } catch (error) {
    console.error(
      `Failed to generate static paths for product pages: ${
        error instanceof Error ? error.message : "Unknown error"
      }.`
    )
    return []
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle, countryCode } = await params
  const region = await getRegion(countryCode)

  if (!region) {
    notFound()
  }

  const product = await getProductByHandle(handle, region.id)

  if (!product) {
    notFound()
  }

  return {
    title: product.title,
    description: product.description ?? product.title,
    openGraph: {
      title: product.title,
      description: product.description ?? product.title,
      images: product.thumbnail ? [product.thumbnail] : [brand.defaultOgImage],
    },
    alternates: {
      canonical: `${brand.url}/fr/products/${product.handle}`,
    },
  }
}

export default async function ProductPage({ params }: Props) {
  const { handle, countryCode } = await params
  const region = await getRegion(countryCode)

  if (!region) {
    notFound()
  }

  const [pricedProduct, fashionData] = await Promise.all([
    getProductByHandle(handle, region.id),
    getProductFashionDataByHandle(handle),
  ])

  if (!pricedProduct) {
    notFound()
  }

  const firstVariant = pricedProduct.variants?.[0]
  const calculatedPrice = firstVariant?.calculated_price
  const inStock = pricedProduct.variants?.some(
    // `inventory_quantity` llega en la respuesta pero no está en el tipo del
    // SDK. Se acota al campo concreto en vez de usar `any`, que apagaba el
    // chequeo de tipos de toda la variante.
    (v) => ((v as { inventory_quantity?: number }).inventory_quantity ?? 0) > 0
  )
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: pricedProduct.title,
    description: pricedProduct.description ?? pricedProduct.title,
    ...(pricedProduct.thumbnail && { image: pricedProduct.thumbnail }),
    ...(calculatedPrice?.calculated_amount != null && {
      offers: {
        "@type": "Offer",
        price: (calculatedPrice.calculated_amount / 100).toFixed(2),
        priceCurrency: calculatedPrice.currency_code?.toUpperCase() ?? "EUR",
        availability: inStock
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        url: `${brand.url}/fr/products/${pricedProduct.handle}`,
      },
    }),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductTemplate
        product={pricedProduct}
        materials={fashionData.materials}
        region={region}
        countryCode={countryCode}
      />
    </>
  )
}
