import { Metadata } from "next"
import { notFound } from "next/navigation"

import {
  getCollectionByHandle,
  getCollectionsList,
} from "@lib/data/collections"
import { listCountryCodes } from "@lib/data/regions"
import { StoreCollection } from "@medusajs/types"
import CollectionTemplate from "@modules/collections/templates"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { collectionMetadataCustomFieldsSchema } from "@lib/util/collections"
import { brand } from "@lib/brand"

type Props = {
  params: Promise<{ handle: string; countryCode: string }>
  searchParams: Promise<{
    category?: string | string[]
    type?: string | string[]
    page?: string
    sortBy?: SortOptions
  }>
}

export async function generateStaticParams() {
  try {
    const { collections } = await getCollectionsList()

    if (!collections) {
      return []
    }

    const countryCodes = await listCountryCodes()

    const collectionHandles = collections.map(
      (collection: StoreCollection) => collection.handle
    )

    return countryCodes.flatMap((countryCode) =>
      collectionHandles.map((handle: string | undefined) => ({
        countryCode,
        handle,
      }))
    )
  } catch (error) {
    // Se ejecuta al compilar: sin este catch, un backend que no responde
    // tumba el build entero en vez de dejar estas páginas bajo demanda.
    console.error(
      `No se pudieron generar las rutas de colección: ${
        error instanceof Error ? error.message : "error desconocido"
      }.`
    )
    return []
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params

  const collection = await getCollectionByHandle(handle, [
    "id",
    "title",
    "metadata",
  ])

  if (!collection) {
    notFound()
  }

  const collectionDetails = collectionMetadataCustomFieldsSchema.safeParse(
    collection.metadata ?? {}
  )

  const description =
    collectionDetails.success && collectionDetails.data.description
      ? collectionDetails.data.description
      : `${collection.title} collection`

  return {
    title: collection.title,
    description,
    openGraph: {
      title: collection.title,
      description,
      images: [brand.defaultOgImage],
    },
    alternates: {
      canonical: `${brand.url}/fr/collections/${handle}`,
    },
  } as Metadata
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { handle, countryCode } = await params
  const { sortBy, page, category, type } = await searchParams

  const collection = await getCollectionByHandle(handle, [
    "id",
    "title",
    "metadata",
  ])

  if (!collection) {
    notFound()
  }

  return (
    <CollectionTemplate
      collection={collection}
      page={page}
      sortBy={sortBy}
      countryCode={countryCode}
      category={
        !category ? undefined : Array.isArray(category) ? category : [category]
      }
      type={!type ? undefined : Array.isArray(type) ? type : [type]}
    />
  )
}
