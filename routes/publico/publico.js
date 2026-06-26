'use strict';

const express = require('express');
const route = express.Router();
const models = require('../../models');
const {
  web_veterinarios: WebVeterinarios,
  WebCobrancas,
  WebCobrancaItens,
  WebPagamentos
} = models;
const { getStripe } = require('../../utils/stripeClient');
const { syncPaidCheckoutSession } = require('../../utils/checkoutSync');

// GET /publico/verificar-checkout?session_id=cs_...
// Usado pela página de sucesso como fallback do webhook: confirma o pagamento
// e devolve o estado atual da cobrança.
route.get('/publico/verificar-checkout', async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ success: false, message: 'session_id obrigatório' });

    // Localiza a cobrança pela sessão para descobrir a conta conectada.
    const cobranca = await WebCobrancas.findOne({
      where: { stripe_checkout_session_id: session_id }
    });
    if (!cobranca) return res.status(404).json({ success: false, message: 'Cobrança não encontrada' });

    const vet = await WebVeterinarios.findByPk(cobranca.web_veterinarios_id);
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      stripeAccount: vet && vet.stripe_connect_account_id ? vet.stripe_connect_account_id : undefined
    });

    if (session.payment_status === 'paid' && cobranca.status !== 'paga') {
      await syncPaidCheckoutSession(session);
    }

    // Recarrega já com itens e pagamento para montar o recibo na tela de sucesso.
    const atual = await WebCobrancas.findByPk(cobranca.id, {
      include: [
        { model: WebCobrancaItens, as: 'itens' },
        { model: WebPagamentos, as: 'pagamentos' }
      ]
    });
    const itens = (atual.itens || [])
      .slice()
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
      .map((it) => ({
        descricao: it.descricao,
        quantidade: it.quantidade,
        valor_unitario_cents: it.valor_unitario_cents
      }));
    const pagamento = (atual.pagamentos || [])[0];

    return res.json({
      success: true,
      paid: session.payment_status === 'paid',
      status: atual.status,
      cobrancaId: atual.id,
      cliente_nome: atual.cliente_nome,
      descricao: atual.descricao,
      total_cents: atual.total_cents,
      currency: atual.currency,
      itens,
      vet_nome: vet ? vet.no_completo : null,
      pago_em: pagamento ? pagamento.createdAt : null
    });
  } catch (err) {
    console.error('GET /publico/verificar-checkout', err);
    return res.status(500).json({ success: false, message: 'Erro ao verificar pagamento' });
  }
});

module.exports = route;
