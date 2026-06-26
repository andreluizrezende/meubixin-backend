'use strict';

const { getStripe, getSubscriptionPriceId, getWebAppUrl } = require('./stripeClient');
const models = require('../models');

/**
 * Garante que o veterinário tenha um customer Stripe (assinatura do SaaS).
 * Salva stripe_customer_id em web_veterinarios e devolve o id.
 */
async function getOrCreateCustomer(vet) {
  if (vet.stripe_customer_id) return vet.stripe_customer_id;
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: vet.ds_email,
    name: vet.no_completo,
    metadata: { web_veterinarios_id: String(vet.id) }
  });
  await models.web_veterinarios.update(
    { stripe_customer_id: customer.id },
    { where: { id: vet.id } }
  );
  return customer.id;
}

/**
 * Cria uma Checkout Session de assinatura (mode: subscription) na conta da
 * plataforma. Inclui um período de teste gratuito de 14 dias.
 */
async function createSubscriptionCheckout(vet, customerId) {
  const stripe = getStripe();
  const web = getWebAppUrl();
  return stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: getSubscriptionPriceId(), quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { web_veterinarios_id: String(vet.id) }
    },
    metadata: { web_veterinarios_id: String(vet.id) },
    success_url: `${web}/pagamento/sucesso?tipo=assinatura&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${web}/plano?status=cancelado`
  });
}

/** Cria uma sessão do Billing Portal para o veterinário gerenciar a assinatura. */
async function createBillingPortalSession(customerId) {
  const stripe = getStripe();
  const web = getWebAppUrl();
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${web}/plano`
  });
}

module.exports = {
  getOrCreateCustomer,
  createSubscriptionCheckout,
  createBillingPortalSession
};
