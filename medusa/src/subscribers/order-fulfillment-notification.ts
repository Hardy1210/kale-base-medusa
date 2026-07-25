import type { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';

/**
 * Envía el email "tu pedido va en camino" cuando el comerciante crea el
 * fulfillment del pedido en el admin (marca preparado/enviado).
 * Usa la plantilla `order-update` (ya existente). Aplica tanto a clientes
 * registrados como a invitados, porque se envía a `order.email`.
 */
export default async function sendOrderShippedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ order_id: string; no_notification?: boolean }>) {
  if (data.no_notification) {
    return;
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const notificationModuleService = container.resolve(Modules.NOTIFICATION);

  const {
    data: [order],
  } = await query.graph({
    entity: 'order',
    fields: ['id', 'display_id', 'email', 'customer_id'],
    filters: { id: data.order_id },
  });

  if (!order) {
    return;
  }

  const {
    data: [customer],
  } = await query.graph({
    entity: 'customer',
    fields: ['id', 'email', 'first_name', 'last_name'],
    filters: { id: order.customer_id },
  });

  await notificationModuleService.createNotifications({
    to: order.email,
    channel: 'email',
    template: 'order-update',
    data: { order, customer },
  });
}

export const config: SubscriberConfig = {
  event: 'order.fulfillment_created',
};
