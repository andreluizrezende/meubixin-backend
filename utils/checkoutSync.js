'use strict';

const models = require('../models');
const { WebCobrancas, WebPagamentos } = models;

/**
 * Sincroniza uma Checkout Session de cobrança (Connect) que foi paga:
 * marca a cobrança como "paga" e cria o registro de pagamento (idempotente
 * por stripe_checkout_session_id).
 *
 * @param {object} session - Stripe.Checkout.Session paga
 * @returns {Promise<{ cobrancaId: number } | null>}
 */
async function syncPaidCheckoutSession(session) {
  const cobrancaId = Number(
    (session.metadata && session.metadata.web_cobrancas_id) || session.client_reference_id
  );
  if (!cobrancaId) return null;

  const cobranca = await WebCobrancas.findByPk(cobrancaId);
  if (!cobranca) return null;

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent && session.payment_intent.id;

  await WebCobrancas.update(
    {
      status: 'paga',
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId || null
    },
    { where: { id: cobrancaId } }
  );

  // Idempotência: não duplica pagamento para a mesma sessão.
  const jaExiste = await WebPagamentos.findOne({
    where: { stripe_checkout_session_id: session.id }
  });
  if (!jaExiste) {
    await WebPagamentos.create({
      web_cobrancas_id: cobrancaId,
      stripe_payment_intent_id: paymentIntentId || null,
      stripe_checkout_session_id: session.id,
      amount_cents: session.amount_total != null ? session.amount_total : cobranca.total_cents,
      currency: session.currency || cobranca.currency,
      stripe_fee_cents: null
    });
  }

  return { cobrancaId };
}

module.exports = { syncPaidCheckoutSession };
