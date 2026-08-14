import type { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { withErrorReporting } from '../lib/subscriber-error-reporting';

/**
 * Avisa al comerciante de que ha entrado un pedido nuevo.
 *
 * La campanita del admin NO cubre esto: en Medusa 2.8 el canal `feed` solo lo
 * alimentan los workflows de import/export de productos, así que sin este
 * email no existe ninguna señal automática de que hay algo que preparar.
 *
 * Se envía a MERCHANT_NOTIFICATION_EMAIL. Si la variable no está definida el
 * subscriber no hace nada más que avisar en el log, para no romper los
 * entornos donde no esté configurada.
 */
async function sendOrderPlacedMerchantNotification({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const merchantEmail = process.env.MERCHANT_NOTIFICATION_EMAIL;

  if (!merchantEmail) {
    logger.warn(
      'MERCHANT_NOTIFICATION_EMAIL no está definida: no se envía el aviso de pedido nuevo al comerciante.',
    );
    return;
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const notificationModuleService = container.resolve(Modules.NOTIFICATION);

  const {
    data: [order],
  } = await query.graph({
    entity: 'order',
    fields: [
      'id',
      'display_id',
      'email',
      'currency_code',
      'total',
      'shipping_address.*',
      'items.id',
      'items.product_title',
      'items.variant_title',
      'items.quantity',
      'items.total',
    ],
    filters: { id: data.id },
  });

  if (!order) {
    return;
  }

  await notificationModuleService.createNotifications({
    to: merchantEmail,
    channel: 'email',
    template: 'order-placed-merchant',
    data: { order },
  });
}

export default withErrorReporting(sendOrderPlacedMerchantNotification);

export const config: SubscriberConfig = {
  event: 'order.placed',
};
