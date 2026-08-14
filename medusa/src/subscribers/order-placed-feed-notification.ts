import type { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { OrderDTO } from '@medusajs/framework/types';
import { withErrorReporting } from '../lib/subscriber-error-reporting';

/**
 * Deja constancia del pedido nuevo en la campanita del admin (canal `feed`).
 *
 * Medusa no trae esto de serie: el canal `feed` solo lo alimentan los
 * workflows de import/export de productos, así que sin este subscriber la
 * campanita nunca se entera de una venta.
 *
 * Es la red de seguridad del starter: funciona nada más clonarlo, sin ninguna
 * variable de entorno. La alerta de verdad sigue siendo el email de
 * `order-placed-merchant-notification.ts`, que sí requiere configurar
 * MERCHANT_NOTIFICATION_EMAIL.
 *
 * Formato (`to: ''`, `template: 'admin-ui'`, `data.title` obligatorio) copiado
 * de los workflows de core-flows, que es lo que el admin sabe pintar.
 */
async function sendOrderPlacedFeedNotification({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const notificationModuleService = container.resolve(Modules.NOTIFICATION);

  const fields = [
    'id',
    'display_id',
    'email',
    'currency_code',
    'total',
  ] as const satisfies (keyof OrderDTO)[];

  const { data: orders } = await query.graph({
    entity: 'order',
    fields,
    filters: { id: data.id },
  });

  // Doble cast a propósito: el tipo `Order` que infiere query.graph no declara
  // `display_id`, aunque en runtime sí llega porque lo pedimos en `fields`.
  const order = orders[0] as unknown as Pick<OrderDTO, (typeof fields)[number]>;

  if (!order) {
    return;
  }

  const formattedTotal = new Intl.NumberFormat([], {
    style: 'currency',
    currencyDisplay: 'narrowSymbol',
    currency: order.currency_code,
  }).format(Number(order.total));

  await notificationModuleService.createNotifications({
    to: '',
    channel: 'feed',
    template: 'admin-ui',
    data: {
      title: `New order #${order.display_id}`,
      description: `${formattedTotal} — ${order.email}`,
    },
  });
}

export default withErrorReporting(sendOrderPlacedFeedNotification);

export const config: SubscriberConfig = {
  event: 'order.placed',
};
