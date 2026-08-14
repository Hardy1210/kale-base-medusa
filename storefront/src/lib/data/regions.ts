import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"

export const listRegions = async function () {
  return sdk.client
    .fetch<{ regions: HttpTypes.StoreRegion[] }>(`/store/regions`, {
      method: "GET",
      next: { tags: ["regions"] },
      cache: "force-cache",
    })
    .then(({ regions }) => regions)
    .catch(medusaError)
}

export const retrieveRegion = async function (id: string) {
  return sdk.client
    .fetch<{ region: HttpTypes.StoreRegion }>(`/store/regions/${id}`, {
      method: "GET",
      next: { tags: [`regions`] },
      cache: "force-cache",
    })
    .then(({ region }) => region)
    .catch(medusaError)
}

/**
 * Códigos de país de todas las regiones, para los `generateStaticParams`.
 *
 * Devuelve `[]` si el backend no responde, en lugar de propagar el error.
 * `generateStaticParams` se ejecuta AL COMPILAR, así que una excepción ahí
 * aborta el build entero del storefront: un despliegue lanzado mientras Medusa
 * reinicia se caía sin más. Con la lista vacía, Next sirve esas páginas bajo
 * demanda — se degrada, no se rompe.
 *
 * Es el mismo criterio que ya seguía la ficha de producto, la única página que
 * capturaba el fallo. Además evita repetir el mismo bloque en las seis páginas
 * que lo tenían copiado.
 */
export const listCountryCodes = async function (): Promise<string[]> {
  try {
    const regions = await listRegions()

    return (regions ?? []).flatMap(
      (region) =>
        region.countries
          ?.map((country) => country.iso_2)
          .filter((iso): iso is string => Boolean(iso)) ?? []
    )
  } catch (error) {
    console.error(
      `No se pudieron leer las regiones para las rutas estáticas: ${
        error instanceof Error ? error.message : "error desconocido"
      }. Esas páginas se renderizarán bajo demanda.`
    )
    return []
  }
}

const regionMap = new Map<string, HttpTypes.StoreRegion>()

export const getRegion = async function (countryCode: string) {
  try {
    if (regionMap.has(countryCode)) {
      return regionMap.get(countryCode)
    }

    const regions = await listRegions()

    if (!regions) {
      return null
    }

    regions.forEach((region) => {
      region.countries?.forEach((c) => {
        regionMap.set(c?.iso_2 ?? "", region)
      })
    })

    const region = countryCode
      ? regionMap.get(countryCode)
      : regionMap.get("fr")

    return region
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    return null
  }
}
