'use strict';

const express = require('express');
const route = express.Router();
const models = require('../../models');
const {
  web_veterinarios: WebVeterinarios,
  WebAssinaturas,
  WebStripeEvents
} = models;
const { getStripe, getWebhookSecret } = require('../../utils/stripeClient');
const { mapAccountToFlags } = require('../../utils/stripeConnect');
const { syncPaidCheckoutSession } = require('../../utils/checkoutSync');

// Marca evento como processado (idempotência). Retorna false se já existia.
async function registrarEvento(eventId) {
  try {
    await WebStripeEvents.create({ event_id: eventId, processed_at: new Date() });
    return true;
  } catch (err) {
    // PK duplicada => já processado.
    return false;
  }
}

// Upsert da assinatura do SaaS a partir de um objeto Stripe.Subscription.
async function upsertAssinatura(subscription) {
  const vetId = subscription.metadata && subscription.metadata.web_veterinarios_id;
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer && subscription.customer.id;

  // Localiza o veterinário por metadata ou por customer.
  let vet = null;
  if (vetId) vet = await WebVeterinarios.findByPk(vetId);
  if (!vet && customerId) {
    vet = await WebVeterinarios.findOne({ where: { stripe_customer_id: customerId } });
  }
  if (!vet) return;

  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null;
  const plano =
    subscription.items &&
    subscription.items.data &&
    subscription.items.data[0] &&
    subscription.items.data[0].price
      ? subscription.items.data[0].price.id
      : null;

  const dados = {
    web_veterinarios_id: vet.id,
    stripe_customer_id: customerId || vet.stripe_customer_id,
    stripe_subscription_id: subscription.id,
    status: subscription.status,
    plano,
    current_period_end: periodEnd
  };

  const existente = await WebAssinaturas.findOne({ where: { web_veterinarios_id: vet.id } });
  if (existente) {
    await WebAssinaturas.update(dados, { where: { web_veterinarios_id: vet.id } });
  } else {
    await WebAssinaturas.create(dados);
  }
}

// POST /webhooks/stripe — montado com express.raw em index.js (corpo cru).
route.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, getWebhookSecret());
  } catch (err) {
    console.warn('Webhook Stripe inválido:', err.message);
    return res.status(400).json({ error: 'Assinatura inválida' });
  }

  // Idempotência.
  const novo = await registrarEvento(event.id);
  if (!novo) return res.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        // Apenas cobranças (mode payment). Assinaturas são tratadas pelos
        // eventos customer.subscription.* / invoice.*.
        if (session.mode === 'payment' && session.payment_status === 'paid') {
          await syncPaidCheckoutSession(session);
        }
        break;
      }
      case 'account.updated': {
        const account = event.data.object;
        const vet = await WebVeterinarios.findOne({
          where: { stripe_connect_account_id: account.id }
        });
        if (vet) {
          await WebVeterinarios.update(mapAccountToFlags(account), { where: { id: vet.id } });
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await upsertAssinatura(event.data.object);
        break;
      }
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription && invoice.subscription.id;
        if (subId) {
          const subscription = await getStripe().subscriptions.retrieve(subId);
          await upsertAssinatura(subscription);
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('Erro ao processar webhook', event.type, err);
    return res.status(500).json({ error: 'Falha ao processar evento' });
  }

  return res.json({ received: true });
});

module.exports = route;
