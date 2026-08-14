import { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework";
import { IPaymentModuleService } from "@medusajs/framework/types";
import { MedusaError, Modules } from "@medusajs/framework/utils";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_API_KEY);

/**
 * Asocia una tarjeta a la sesión de pago del carrito durante el checkout.
 *
 * La ruta es pública porque el checkout de invitados no tiene sesión de
 * cliente. El modelo de seguridad es el mismo que usa Medusa en el resto de
 * `/store`: poseer el identificador de la sesión es lo que autoriza a operar
 * sobre ella. Por eso lo único que se puede —y se debe— comprobar aquí es que
 * esa sesión siga admitiendo cambios.
 */
export const POST = async (
  req: MedusaStoreRequest<{
    session_id: string;
    token: string;
  }>,
  res: MedusaResponse
) => {
  const paymentModuleService: IPaymentModuleService = req.scope.resolve(
    Modules.PAYMENT
  );

  if (!req.body?.session_id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "session_id es obligatorio"
    );
  }

  const session = await paymentModuleService.retrievePaymentSession(
    req.body.session_id
  );

  // Sin esta comprobación se puede cambiar la tarjeta de un pago ya cobrado.
  //
  // Se listan los estados PROHIBIDOS en vez de exigir `pending`: tras un 3DS
  // fallido la sesión queda en `requires_more` o `error`, y el comprador tiene
  // que poder reintentar con otra tarjeta. Exigir `pending` habría roto ese
  // reintento, que es un caso normal, no un abuso.
  if (["authorized", "captured", "canceled"].includes(session.status)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Esta sesión de pago ya no admite cambios de método de pago"
    );
  }

  if (!req.body.token) {
    await paymentModuleService.updatePaymentSession({
      ...session,
      data: {
        ...session.data,
        payment_method_id: null,
      },
    });

    // Sin este `return` la ejecución seguía después de haber respondido y
    // llamaba a Stripe con un token vacío, lanzando una excepción con la
    // respuesta ya enviada.
    res.status(200).json({ success: true });
    return;
  }

  const paymentMethod = await stripe.paymentMethods.create({
    type: "card",
    card: { token: req.body.token },
  });

  await stripe.paymentIntents.update(session.data.id as string, {
    payment_method: paymentMethod.id,
  });
  await paymentModuleService.updatePaymentSession({
    ...session,
    data: {
      ...session.data,
      payment_method_id: paymentMethod.id,
    },
  });

  res.status(200).json({ success: true });
};
