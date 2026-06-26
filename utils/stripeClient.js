'use strict';

const Stripe = require('stripe');

let stripeSingleton = null;

/**
 * Retorna uma instância única (singleton) do SDK do Stripe.
 * Lança erro se a STRIPE_SECRET_KEY não estiver configurada.
 */
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY não configurada');
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key);
  }
  return stripeSingleton;
}

/** Secret usado para validar a assinatura dos webhooks. */
function getWebhookSecret() {
  const s = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s) throw new Error('STRIPE_WEBHOOK_SECRET não configurada');
  return s;
}

/** Price recorrente do plano de assinatura do SaaS. */
function getSubscriptionPriceId() {
  const p = process.env.STRIPE_PRICE_ID;
  if (!p) throw new Error('STRIPE_PRICE_ID não configurada');
  return p;
}

/** País padrão das contas Connect Express (default BR). */
function getDefaultConnectCountry() {
  return process.env.STRIPE_CONNECT_DEFAULT_COUNTRY || 'BR';
}

/** URL base do frontend (sem barra final), usada nos redirects. */
function getWebAppUrl() {
  const u = process.env.WEB_APP_URL || 'http://localhost:3000';
  return u.replace(/\/$/, '');
}

module.exports = {
  getStripe,
  getWebhookSecret,
  getSubscriptionPriceId,
  getDefaultConnectCountry,
  getWebAppUrl,
};
