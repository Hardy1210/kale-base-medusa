import * as React from "react"
import { listRegions } from "@lib/data/regions"
import { SearchField } from "@/components/SearchField"
import { Layout, LayoutColumn } from "@/components/Layout"
import { LocalizedLink } from "@/components/LocalizedLink"
import { HeaderDrawer } from "@/components/HeaderDrawer"
import { RegionSwitcher } from "@/components/RegionSwitcher"
import { HeaderWrapper } from "@/components/HeaderWrapper"
import { brand } from "@lib/brand"

import dynamic from "next/dynamic"

const LoginLink = dynamic(
  () => import("@modules/header/components/LoginLink"),
  { loading: () => <></> }
)

const CartDrawer = dynamic(
  () => import("@/components/CartDrawer").then((mod) => mod.CartDrawer),
  { loading: () => <></> }
)

export const Header: React.FC = async () => {
  // `listRegions` lanza si Medusa no responde (usa `medusaError`). El Header lo
  // pinta TODO —incluida `/_not-found`, que se prerenderiza al compilar—, así
  // que esa excepción tumbaba el build entero del storefront: un despliegue
  // lanzado mientras el backend reiniciaba moría con
  // "Export encountered an error on /_not-found/page".
  //
  // Con la lista vacía el selector de país no se pinta y el resto de la
  // cabecera —marca, buscador, carrito, cuenta— funciona igual. Se degrada en
  // vez de romperse, que es el mismo criterio que ya seguía `listCountryCodes`.
  let regions: Awaited<ReturnType<typeof listRegions>> = []

  try {
    regions = (await listRegions()) ?? []
  } catch (error) {
    console.error(
      `No se pudieron leer las regiones para la cabecera: ${
        error instanceof Error ? error.message : "error desconocido"
      }. El selector de país no se mostrará.`
    )
  }

  const countryOptions = regions
    .map((r) => {
      return (r.countries ?? []).map((c) => ({
        country: c.iso_2,
        region: r.id,
        label: c.display_name,
      }))
    })
    .flat()
    .sort((a, b) => (a?.label ?? "").localeCompare(b?.label ?? ""))

  return (
    <>
      <HeaderWrapper>
        <Layout>
          <LayoutColumn>
            <div className="flex justify-between items-center h-18 md:h-21">
              <h1 className="font-medium text-md">
                <LocalizedLink href="/">{brand.name}</LocalizedLink>
              </h1>
              <div className="flex items-center gap-8 max-md:hidden">
                <LocalizedLink href="/about">About</LocalizedLink>
                <LocalizedLink href="/inspiration">Inspiration</LocalizedLink>
                <LocalizedLink href="/store">Shop</LocalizedLink>
              </div>
              <div className="flex items-center gap-3 lg:gap-6 max-md:hidden">
                <RegionSwitcher
                  countryOptions={countryOptions}
                  className="w-16"
                  selectButtonClassName="h-auto !gap-0 !p-1 transition-none"
                  selectIconClassName="text-current"
                />
                <React.Suspense>
                  <SearchField countryOptions={countryOptions} />
                </React.Suspense>
                <LoginLink className="p-1 group-data-[light=true]:md:text-white group-data-[sticky=true]:md:text-black" />
                <CartDrawer />
              </div>
              <div className="flex items-center gap-4 md:hidden">
                <LoginLink className="p-1 group-data-[light=true]:md:text-white" />
                <CartDrawer />
                <React.Suspense>
                  <HeaderDrawer countryOptions={countryOptions} />
                </React.Suspense>
              </div>
            </div>
          </LayoutColumn>
        </Layout>
      </HeaderWrapper>
    </>
  )
}
