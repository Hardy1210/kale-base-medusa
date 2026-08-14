import { MedusaError } from "@medusajs/framework/utils";
import { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_API_KEY);

/**
 * Devuelve la marca y los 4 últimos dígitos de la tarjeta, para pintarlos en el
 * resumen del checkout.
 *
 * Antes devolvía el objeto PaymentMethod completo de Stripe, que incluye
 * `billing_details`: nombre, email, teléfono y dirección postal del comprador.
 * Como la ruta es pública —el checkout de invitados no tiene sesión—, eso
 * convertía la clave secreta de Stripe en un buscador abierto de datos
 * personales para cualquiera que consiguiera un `pm_...`.
 *
 * La UI solo usa `card.brand` y `card.last4` (ver
 * `storefront/src/modules/checkout/components/payment/index.tsx`), así que se
 * devuelve exactamente eso y nada más.
 */
export const GET = async (req: MedusaStoreRequest, res: MedusaResponse) => {
  const { id } = req.params;

  // Sin esto, el `id` de la URL se puede usar para sondear otros tipos de
  // objeto de la cuenta de Stripe a través de esta ruta.
  if (!id?.startsWith("pm_")) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Identificador de método de pago no válido"
    );
  }

  const paymentMethod = await stripe.paymentMethods.retrieve(id);

  res.status(200).json({
    id: paymentMethod.id,
    card: paymentMethod.card
      ? {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
        }
      : null,
  });
};
