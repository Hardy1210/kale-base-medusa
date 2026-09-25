import type { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { Logger, RemoteQueryFunction } from "@medusajs/framework/types";
import { FASHION_MODULE } from "../modules/fashion";
import { captureException } from "../lib/sentry";

/**
 * Invalida la caché de datos del storefront cuando cambia el catálogo en el
 * admin. Sin esto, lo editado no se ve en la tienda hasta que caduca el TTL
 * (5 min) o hasta el siguiente despliegue.
 *
 * Traduce cada evento a etiquetas de caché y las manda a POST /api/revalidate
 * del storefront. Las etiquetas son el contrato con
 * `storefront/src/lib/cache-tags.ts`: si cambias una, cambia la otra.
 *
 * Lo que NO se escucha, a propósito:
 * - Inventario: el stock va en una petición aparte con TTL de 30 s, y así las
 *   ventas no tiran la caché del catálogo.
 * - Listas de precios: no emiten eventos. Las cubre el TTL de 5 min.
 * - Añadir/quitar productos desde la página de una colección
 *   (`batchLinkProductsToCollectionWorkflow`): no emite eventos. TTL.
 *
 * NUNCA lanza. Un aviso fallido no debe bloquear ni reintentar el guardado en
 * el admin: el error va al log y a Sentry, y el TTL acaba arreglándolo. Por eso
 * no usa `withErrorReporting`, que relanza para que el bus reintente.
 */

// Mismos límites que la ruta del storefront.
const MAX_TAGS_PER_REQUEST = 200;
const REQUEST_TIMEOUT_MS = 5000;

const TAGS = {
  products: "products",
  collections: "collections",
  categories: "categories",
  productTypes: "product-types",
  fashion: "fashion",
  product: (id: string) => `product:${id}`,
  productHandle: (handle: string) => `product-handle:${handle}`,
  collection: (id: string) => `collection:${id}`,
  collectionHandle: (handle: string) => `collection-handle:${handle}`,
};

const actions = (entity: string) =>
  ["created", "updated", "deleted"].map((action) => `${entity}.${action}`);

// MedusaService emite `<servicio>.<modelo>.<acción>` en cada create/update/
// delete/softDelete/restore, aunque se llame al servicio fuera de un workflow.
const fashionEvents = ["material", "color"].flatMap((model) => [
  ...actions(`${FASHION_MODULE}.${model}`),
  `${FASHION_MODULE}.${model}.restored`,
]);

type Query = Omit<RemoteQueryFunction, symbol>;

function productTags(product: { id: string; handle?: string | null }) {
  const tags = [TAGS.product(product.id)];
  if (product.handle) {
    tags.push(TAGS.productHandle(product.handle));
  }
  return tags;
}

async function tagsForEvent(
  eventName: string,
  id: string,
  query: Query,
): Promise<string[]> {
  const [entity] = eventName.split(".");

  switch (entity) {
    case "product": {
      const {
        data: [product],
      } = await query.graph({
        entity: "product",
        fields: ["id", "handle"],
        filters: { id },
        withDeleted: true,
      });
      return [TAGS.products, ...productTags(product ?? { id })];
    }

    case "product-variant": {
      const {
        data: [variant],
      } = await query.graph({
        entity: "product_variant",
        fields: ["product.id", "product.handle"],
        filters: { id },
        withDeleted: true,
      });
      // Sin producto no hay ficha que invalidar, pero sí los listados.
      return [
        TAGS.products,
        ...(variant?.product ? productTags(variant.product) : []),
      ];
    }

    case "product-collection": {
      const {
        data: [collection],
      } = await query.graph({
        entity: "product_collection",
        fields: ["id", "handle", "products.id", "products.handle"],
        filters: { id },
        withDeleted: true,
      });
      // Las tarjetas de producto muestran la colección y la ficha usa su
      // metadata, así que también caen `products` y las fichas de la colección.
      const tags = [TAGS.collections, TAGS.products, TAGS.collection(id)];
      if (collection?.handle) {
        tags.push(TAGS.collectionHandle(collection.handle));
      }
      for (const product of collection?.products ?? []) {
        if (product) {
          tags.push(...productTags(product));
        }
      }
      return tags;
    }

    case "product-category":
      return [TAGS.categories];

    case "product-type":
      return [TAGS.productTypes];

    case FASHION_MODULE:
      return [TAGS.fashion];

    default:
      return [];
  }
}

async function postTags(storefrontUrl: string, secret: string, tags: string[]) {
  const url = new URL("/api/revalidate", storefrontUrl);

  for (let i = 0; i < tags.length; i += MAX_TAGS_PER_REQUEST) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-revalidate-secret": secret,
      },
      body: JSON.stringify({ tags: tags.slice(i, i + MAX_TAGS_PER_REQUEST) }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(
        `POST ${url} respondió ${response.status}: ${await response.text()}`,
      );
    }
  }
}

export default async function revalidateStorefront({
  event: { name, data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger: Logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const storefrontUrl = process.env.STOREFRONT_URL;
  const secret = process.env.REVALIDATE_SECRET;

  if (!storefrontUrl || !secret) {
    logger.warn(
      "STOREFRONT_URL o REVALIDATE_SECRET no están definidas: no se invalida la caché del storefront.",
    );
    return;
  }

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const tags = Array.from(new Set(await tagsForEvent(name, data.id, query)));

    if (!tags.length) {
      return;
    }

    await postTags(storefrontUrl, secret, tags);
    logger.debug(
      `Caché del storefront invalidada (${name}): ${tags.join(", ")}`,
    );
  } catch (error) {
    logger.error(
      `No se pudo invalidar la caché del storefront tras "${name}" (${data?.id}). Se verá al caducar el TTL.`,
    );
    logger.error(error);
    captureException(error, {
      subscriber: "revalidateStorefront",
      event: name,
      data,
    });
  }
}

export const config: SubscriberConfig = {
  event: [
    ...actions("product"),
    ...actions("product-variant"),
    ...actions("product-collection"),
    ...actions("product-category"),
    ...actions("product-type"),
    ...fashionEvents,
  ],
};
