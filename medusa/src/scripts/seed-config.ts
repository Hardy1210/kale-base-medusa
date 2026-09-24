// Configuración mínima de la tienda: región, países, moneda, canal de venta,
// publishable key, almacén, envíos e impuestos. Sin productos.
//
// Apto para producción e IDEMPOTENTE: cada paso busca antes lo que va a crear
// y lo reutiliza si ya existe, así que ejecutarlo dos veces no duplica nada.
// Eso importa porque Medusa crea por su cuenta, al arrancar, el canal
// "Default Sales Channel" y una publishable key: el script los aprovecha en
// vez de crear otros.
//
// Lo que ya existe NO se modifica (países de la región, precios de envío...).
// A partir de la primera ejecución, esos cambios se hacen en el admin.
//
//   Local:       corepack yarn seed:config
//   Producción:  ver PRODUCTION_DEPLOY.md §7
//
// Los productos de demo están aparte, en seed-demo.ts (solo local).
import {
  createApiKeysWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from '@medusajs/medusa/core-flows';
import { ExecArgs } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';

// ─────────────────────────────────────────────────────────────────────────────
// VALORES POR CLIENTE — ajustar aquí antes de la primera ejecución
// ─────────────────────────────────────────────────────────────────────────────

// Moneda de la tienda (código ISO 4217 en minúsculas).
const CURRENCY_CODE = 'eur';

// Países donde se vende (ISO 3166-1 alfa-2 en minúsculas). Por defecto solo el
// del cliente: vender a otros países de la UE tiene consecuencias fiscales
// (ver ROADMAP_PRODUCCION.md, Fase 1).
const COUNTRIES = ['fr'];
// Ejemplo con más países de la UE:
// const COUNTRIES = ['fr', 'es', 'de', 'it', 'pt', 'be', 'nl', 'lu', 'at', 'ie'];

const REGION_NAME = 'Europe';

// Proveedor de pago que se activa en la región. Es el id que registra
// medusa-config.js (identificador "stripe" del paquete + id "stripe").
const PAYMENT_PROVIDER_ID = 'pp_stripe_stripe';

// Proveedor de impuestos de las regiones fiscales. Sin él, Medusa 2.19 no
// calcula impuestos (ver CONFIGURACION_TIENDA.md). Las regiones se crean sin
// tipos: los porcentajes reales se configuran en el admin.
const TAX_PROVIDER_ID = 'tp_system';

// Mismo nombre que el canal que crea Medusa al arrancar, para reutilizarlo.
const SALES_CHANNEL_NAME = 'Default Sales Channel';

// Solo se usa si no existe ya ninguna publishable key.
const PUBLISHABLE_KEY_TITLE = 'Webshop';

const STOCK_LOCATION = {
  name: 'Main Warehouse',
  address: {
    address_1: '',
    city: '',
    country_code: COUNTRIES[0].toUpperCase(),
  },
};

const FULFILLMENT_PROVIDER_ID = 'manual_manual';

// Importes en unidades de la moneda (10 = 10,00 €), no en céntimos.
const SHIPPING_OPTIONS = [
  {
    name: 'Standard Shipping',
    code: 'standard',
    label: 'Standard',
    description: 'Ship in 2-3 days.',
    amount: 10,
  },
  {
    name: 'Express Shipping',
    code: 'express',
    label: 'Express',
    description: 'Ship in 24 hours.',
    amount: 10,
  },
];

// ─────────────────────────────────────────────────────────────────────────────

export default async function seedConfig({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const storeModule = container.resolve(Modules.STORE);
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL);
  const regionModule = container.resolve(Modules.REGION);
  const taxModule = container.resolve(Modules.TAX);
  const stockLocationModule = container.resolve(Modules.STOCK_LOCATION);
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT);
  const apiKeyModule = container.resolve(Modules.API_KEY);

  // ── Canal de venta ────────────────────────────────────────────────────────
  let [salesChannel] = await salesChannelModule.listSalesChannels({
    name: SALES_CHANNEL_NAME,
  });
  if (salesChannel) {
    logger.info(`Canal de venta "${SALES_CHANNEL_NAME}": ya existe.`);
  } else {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: { salesChannelsData: [{ name: SALES_CHANNEL_NAME }] },
    });
    salesChannel = result[0];
    logger.info(`Canal de venta "${SALES_CHANNEL_NAME}": creado.`);
  }

  // ── Región ────────────────────────────────────────────────────────────────
  let [region] = await regionModule.listRegions({ name: REGION_NAME });
  if (region) {
    logger.info(`Región "${REGION_NAME}": ya existe, no se modifica.`);
  } else {
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: REGION_NAME,
            currency_code: CURRENCY_CODE,
            countries: COUNTRIES,
            payment_providers: [PAYMENT_PROVIDER_ID],
          },
        ],
      },
    });
    region = result[0];
    logger.info(`Región "${REGION_NAME}": creada (${COUNTRIES.join(', ')}).`);
  }

  // ── Tienda: moneda, canal y región por defecto ────────────────────────────
  // Solo se rellena lo que falta, para no pisar lo que se haya cambiado en el
  // admin (por ejemplo, monedas añadidas después).
  const [store] = await storeModule.listStores(
    {},
    { relations: ['supported_currencies'] },
  );
  const storeUpdate: Record<string, unknown> = {};
  const hasCurrency = store.supported_currencies?.some(
    (c) => c.currency_code === CURRENCY_CODE,
  );
  if (!hasCurrency) {
    storeUpdate.supported_currencies = [
      ...(store.supported_currencies ?? []).map((c) => ({
        currency_code: c.currency_code,
        is_default: false,
      })),
      { currency_code: CURRENCY_CODE, is_default: true },
    ];
  }
  if (!store.default_sales_channel_id) {
    storeUpdate.default_sales_channel_id = salesChannel.id;
  }
  if (!store.default_region_id) {
    storeUpdate.default_region_id = region.id;
  }
  if (Object.keys(storeUpdate).length) {
    await updateStoresWorkflow(container).run({
      input: { selector: { id: store.id }, update: storeUpdate },
    });
    logger.info(`Tienda: actualizada (${Object.keys(storeUpdate).join(', ')}).`);
  } else {
    logger.info('Tienda: ya configurada.');
  }

  // ── Regiones fiscales ─────────────────────────────────────────────────────
  const existingTaxRegions = await taxModule.listTaxRegions({
    country_code: COUNTRIES,
    parent_id: null,
  });
  const missingTaxCountries = COUNTRIES.filter(
    (country) => !existingTaxRegions.some((tr) => tr.country_code === country),
  );
  if (missingTaxCountries.length) {
    await createTaxRegionsWorkflow(container).run({
      input: missingTaxCountries.map((country_code) => ({
        country_code,
        provider_id: TAX_PROVIDER_ID,
      })),
    });
    logger.info(`Regiones fiscales: creadas (${missingTaxCountries.join(', ')}).`);
  } else {
    logger.info('Regiones fiscales: ya existen.');
  }

  // ── Almacén ───────────────────────────────────────────────────────────────
  let [stockLocation] = await stockLocationModule.listStockLocations({
    name: STOCK_LOCATION.name,
  });
  if (stockLocation) {
    logger.info(`Almacén "${STOCK_LOCATION.name}": ya existe.`);
  } else {
    const { result } = await createStockLocationsWorkflow(container).run({
      input: { locations: [STOCK_LOCATION] },
    });
    stockLocation = result[0];
    logger.info(`Almacén "${STOCK_LOCATION.name}": creado.`);
  }

  const {
    data: [locationLinks],
  } = await query.graph({
    entity: 'stock_location',
    fields: ['id', 'fulfillment_providers.id', 'sales_channels.id'],
    filters: { id: stockLocation.id },
  });

  if (
    !locationLinks.fulfillment_providers?.some(
      (p) => p?.id === FULFILLMENT_PROVIDER_ID,
    )
  ) {
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: FULFILLMENT_PROVIDER_ID },
    });
    logger.info(`Almacén: conectado al proveedor ${FULFILLMENT_PROVIDER_ID}.`);
  }

  if (!locationLinks.sales_channels?.some((sc) => sc?.id === salesChannel.id)) {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: stockLocation.id, add: [salesChannel.id] },
    });
    logger.info('Almacén: vinculado al canal de venta.');
  }

  // ── Perfil de envío ───────────────────────────────────────────────────────
  let [shippingProfile] = await fulfillmentModule.listShippingProfiles({
    type: 'default',
  });
  if (shippingProfile) {
    logger.info(`Perfil de envío "${shippingProfile.name}": ya existe.`);
  } else {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: { data: [{ name: 'Default', type: 'default' }] },
    });
    shippingProfile = result[0];
    logger.info('Perfil de envío "Default": creado.');
  }

  // ── Zona de envío ─────────────────────────────────────────────────────────
  const fulfillmentSetName = `${STOCK_LOCATION.name} delivery`;
  let [fulfillmentSet] = await fulfillmentModule.listFulfillmentSets(
    { name: fulfillmentSetName },
    { relations: ['service_zones'] },
  );
  if (fulfillmentSet) {
    logger.info(`Zona de envío "${fulfillmentSetName}": ya existe.`);
  } else {
    fulfillmentSet = await fulfillmentModule.createFulfillmentSets({
      name: fulfillmentSetName,
      type: 'shipping',
      service_zones: [
        {
          name: REGION_NAME,
          geo_zones: COUNTRIES.map((country_code) => ({
            country_code,
            type: 'country' as const,
          })),
        },
      ],
    });
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    });
    logger.info(`Zona de envío "${fulfillmentSetName}": creada.`);
  }
  const serviceZone = fulfillmentSet.service_zones[0];

  // ── Opciones de envío ─────────────────────────────────────────────────────
  const existingOptions = await fulfillmentModule.listShippingOptions({
    service_zone: { id: serviceZone.id },
  });
  const missingOptions = SHIPPING_OPTIONS.filter(
    (option) => !existingOptions.some((o) => o.name === option.name),
  );
  if (missingOptions.length) {
    await createShippingOptionsWorkflow(container).run({
      input: missingOptions.map((option) => ({
        name: option.name,
        price_type: 'flat' as const,
        provider_id: FULFILLMENT_PROVIDER_ID,
        service_zone_id: serviceZone.id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: option.label,
          description: option.description,
          code: option.code,
        },
        prices: [
          { currency_code: CURRENCY_CODE, amount: option.amount },
          { region_id: region.id, amount: option.amount },
        ],
        rules: [
          { attribute: 'enabled_in_store', value: 'true', operator: 'eq' as const },
          { attribute: 'is_return', value: 'false', operator: 'eq' as const },
        ],
      })),
    });
    logger.info(
      `Opciones de envío: creadas (${missingOptions.map((o) => o.name).join(', ')}).`,
    );
  } else {
    logger.info('Opciones de envío: ya existen.');
  }

  // ── Publishable key ───────────────────────────────────────────────────────
  let [publishableKey] = await apiKeyModule.listApiKeys({
    type: 'publishable',
    revoked_at: null,
  });
  if (publishableKey) {
    logger.info(`Publishable key "${publishableKey.title}": ya existe.`);
  } else {
    const { result } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          { title: PUBLISHABLE_KEY_TITLE, type: 'publishable', created_by: '' },
        ],
      },
    });
    publishableKey = result[0];
    logger.info(`Publishable key "${PUBLISHABLE_KEY_TITLE}": creada.`);
  }

  const {
    data: [keyLinks],
  } = await query.graph({
    entity: 'api_key',
    fields: ['id', 'sales_channels.id'],
    filters: { id: publishableKey.id },
  });
  if (!keyLinks.sales_channels?.some((sc) => sc?.id === salesChannel.id)) {
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: { id: publishableKey.id, add: [salesChannel.id] },
    });
    logger.info('Publishable key: vinculada al canal de venta.');
  }

  // La publishable key no es secreta (viaja al navegador): se muestra para
  // copiarla a NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY del storefront.
  logger.info(`NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${publishableKey.token}`);
  logger.info('Configuración de la tienda terminada.');
}
