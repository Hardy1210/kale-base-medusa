import { timingSafeEqual } from "node:crypto"
import { revalidateTag } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

import { isRevalidatableTag } from "@lib/cache-tags"

// Webhook que llama el subscriber de Medusa cuando cambia el catálogo.
// Body: {"tags": ["products", "product:prod_123", ...]}
// El secreto va en la cabecera `x-revalidate-secret`, nunca en la URL: las
// URLs acaban en los logs del proxy y de Cloudflare.
//
// Nota: el `matcher` del middleware excluye `api`, así que esta ruta no recibe
// el redirect al prefijo de país.

export const dynamic = "force-dynamic"

const MAX_TAGS = 200

function isValidSecret(received: string | null, expected: string) {
  if (!received) {
    return false
  }
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  // timingSafeEqual lanza si las longitudes difieren.
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  const expected = process.env.REVALIDATE_SECRET
  if (!expected) {
    console.error("[revalidate] REVALIDATE_SECRET no está configurado")
    return NextResponse.json(
      { error: "Revalidation not configured" },
      { status: 500 }
    )
  }

  if (!isValidSecret(request.headers.get("x-revalidate-secret"), expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const rawTags = (body as { tags?: unknown } | null)?.tags
  if (!Array.isArray(rawTags)) {
    return NextResponse.json(
      { error: 'Body must be {"tags": [...]}' },
      { status: 400 }
    )
  }

  const allowed = rawTags.filter(isRevalidatableTag)
  const tags = Array.from(new Set(allowed))
  const ignored = rawTags.length - allowed.length

  if (tags.length === 0 || tags.length > MAX_TAGS) {
    return NextResponse.json(
      { error: `Between 1 and ${MAX_TAGS} allowed tags required`, ignored },
      { status: 400 }
    )
  }

  // Next 15: revalidateTag recibe una sola etiqueta. El perfil "max" y
  // `{ expire: 0 }` son de Next 16.
  for (const tag of tags) {
    revalidateTag(tag)
  }

  return NextResponse.json({ revalidated: tags, ignored })
}
