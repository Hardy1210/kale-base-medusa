import AuthPasswordForgotResetEmail from "./auth-forgot-password";
import AuthPasswordResetEmail from "./auth-password-reset";
import OrderPlacedEmail from "./order-placed";
import OrderUpdateEmail from "./order-update";
import WelcomeEmail from "./welcome";

// TODO: we should be able to use notification data in subjects too
export const subjects = {
  "auth-password-reset": "Reset your password",
  "order-placed": "Your order has been placed",
  "order-update": "Your order is on its way",
  "customer-welcome": "Welcome to Sofa Society!",
  "auth-forgot-password": "Reset your password",
};

export default {
  "auth-password-reset": AuthPasswordResetEmail,
  "order-placed": OrderPlacedEmail,
  "order-update": OrderUpdateEmail,
  "customer-welcome": WelcomeEmail,
  "auth-forgot-password": AuthPasswordForgotResetEmail,
};
