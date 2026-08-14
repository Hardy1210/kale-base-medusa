import AuthPasswordForgotResetEmail from "./auth-forgot-password";
import AuthPasswordResetEmail from "./auth-password-reset";
import OrderPlacedEmail from "./order-placed";
import OrderPlacedMerchantEmail from "./order-placed-merchant";
import OrderUpdateEmail from "./order-update";
import WelcomeEmail from "./welcome";

// Los asuntos son strings estáticos (no reciben props como las plantillas), así
// que el nombre de la tienda se lee aquí del .env. Es la MISMA variable que usa
// `medusa-config.js` para el cuerpo de los emails: se cambia en un solo sitio.
const STORE_NAME = process.env.STORE_NAME || "Mi Tienda";

// TODO: we should be able to use notification data in subjects too
export const subjects = {
  "auth-password-reset": "Reset your password",
  "order-placed": "Your order has been placed",
  // Aviso interno al comerciante, no al cliente.
  "order-placed-merchant": "New order received",
  "order-update": "Your order is on its way",
  "customer-welcome": `Welcome to ${STORE_NAME}!`,
  "auth-forgot-password": "Reset your password",
};

export default {
  "auth-password-reset": AuthPasswordResetEmail,
  "order-placed": OrderPlacedEmail,
  "order-placed-merchant": OrderPlacedMerchantEmail,
  "order-update": OrderUpdateEmail,
  "customer-welcome": WelcomeEmail,
  "auth-forgot-password": AuthPasswordForgotResetEmail,
};
