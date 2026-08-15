"use client"

import { useParams, usePathname } from "next/navigation"
import { twMerge } from "tailwind-merge"
import { Layout, LayoutColumn } from "@/components/Layout"
import { NewsletterForm } from "@/components/NewsletterForm"
import { LocalizedLink } from "@/components/LocalizedLink"
import { brand } from "@lib/brand"

// Redes sociales del cliente. Antes TikTok, Pinterest y Facebook estaban
// escritas a mano apuntando a las portadas genéricas (tiktok.com, facebook.com):
// enlaces que sacaban al comprador de la tienda hacia una red que no era la del
// comerciante. Ahora cada una sale de su variable y, si está vacía, la entrada
// simplemente no se pinta — un comercio pequeño rara vez tiene las cuatro.
const socialLinks = [
  { label: "Instagram", url: process.env.NEXT_PUBLIC_INSTAGRAM_URL },
  { label: "Facebook", url: process.env.NEXT_PUBLIC_FACEBOOK_URL },
  { label: "TikTok", url: process.env.NEXT_PUBLIC_TIKTOK_URL },
  { label: "Pinterest", url: process.env.NEXT_PUBLIC_PINTEREST_URL },
].filter(
  (link): link is { label: string; url: string } =>
    // "#" era el valor de relleno del .env.template original: cuenta como vacío.
    Boolean(link.url) && link.url !== "#"
)

export const Footer: React.FC = () => {
  const pathName = usePathname()
  const { countryCode } = useParams()
  const currentPath = pathName.split(`/${countryCode}`)[1]

  const isAuthPage = currentPath === "/register" || currentPath === "/login"

  return (
    <div
      className={twMerge(
        "bg-grayscale-50 py-8 md:py-20",
        isAuthPage && "hidden"
      )}
    >
      <Layout>
        <LayoutColumn className="col-span-13">
          <div className="flex max-lg:flex-col justify-between md:gap-20 max-md:px-4">
            <div className="flex flex-1 max-lg:w-full max-lg:order-2 max-sm:flex-col justify-between sm:gap-30 lg:gap-20 md:items-center">
              <div className="max-w-35 md:flex-1 max-md:mb-9">
                <h1 className="text-lg md:text-xl mb-2 md:mb-6 leading-none md:leading-[0.9]">
                  {brand.name}
                </h1>
                <p className="text-xs">
                  &copy; {new Date().getFullYear()}, {brand.name}
                </p>
              </div>
              <div className="flex gap-10 xl:gap-18 max-md:text-xs flex-1 justify-between lg:justify-center">
                {/* Antes había aquí cuatro enlaces —FAQ, Help, Delivery,
                    Returns— que apuntaban todos a "/". Se han quitado en vez de
                    dejarlos rotos: son páginas que cada cliente decide si quiere
                    y que hay que redactar con él. Cuando existan, se añaden aquí
                    con su LocalizedLink real. */}
                <ul className="flex flex-col gap-6 md:gap-3.5">
                  {socialLinks.map(({ label, url }) => (
                    <li key={label}>
                      <a href={url} target="_blank" rel="noreferrer noopener">
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
                <ul className="flex flex-col gap-6 md:gap-3.5">
                  <li>
                    <LocalizedLink href="/privacy-policy">
                      Privacy Policy
                    </LocalizedLink>
                  </li>
                  <li>
                    <LocalizedLink href="/cookie-policy">
                      Cookie Policy
                    </LocalizedLink>
                  </li>
                  <li>
                    <LocalizedLink href="/terms-of-use">
                      Terms of Use
                    </LocalizedLink>
                  </li>
                </ul>
              </div>
            </div>

            <NewsletterForm className="flex-1 max-lg:w-full lg:max-w-90 xl:max-w-96 max-lg:order-1 max-md:mb-16" />
          </div>
        </LayoutColumn>
      </Layout>
    </div>
  )
}
