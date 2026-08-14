import { NextResponse } from "next/server"

// Endpoint de salud para el monitor externo (Better Stack). Existe para no
// tener que vigilar la home: renderizarla implica llamadas al backend y a la
// base de datos, así que un chequeo cada 3 minutos generaría carga inútil las
// 24 horas del día.
//
// A propósito NO comprueba si Medusa responde. El backend se vigila con su
// propio monitor contra `https://api.dominio.com/health`, y así, cuando salta
// una alerta, ya sabes CUÁL de los dos ha caído. Si este endpoint dependiera
// del backend, una caída de Medusa dispararía las dos alertas a la vez y
// tendrías que ir a mirar para distinguirlas.
//
// Nota: el `matcher` del middleware excluye `api`, así que esta ruta no recibe
// el redirect al prefijo de país.

// Sin esto Next serviría una respuesta estática generada en el build: el
// monitor vería 200 aunque el servidor estuviera muerto.
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        // Cloudflare va delante del storefront. Sin `no-store` podría cachear
        // este 200 y seguir devolviéndolo con el origen caído — el monitor
        // estaría vigilando la caché, no el servidor.
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  )
}
