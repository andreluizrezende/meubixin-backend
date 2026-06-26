'use strict';

const express = require('express');
const route = express.Router();
const models = require('../../models');
const { web_veterinarios: WebVeterinarios, WebAssinaturas } = models;
const {
  getOrCreateCustomer,
  createSubscriptionCheckout,
  createBillingPortalSession
} = require('../../utils/stripeBilling');

// Considera a assinatura "ativa" para acesso quando active ou em trial.
function assinaturaAtiva(status) {
  return status === 'active' || status === 'trialing';
}

// GET /assinatura/status/:vetId
route.get('/assinatura/status/:vetId', async (req, res) => {
  try {
    const vet = await WebVeterinarios.findByPk(req.params.vetId);
    if (!vet) return res.status(404).json({ success: false, message: 'Veterinário não encontrado' });

    const assinatura = await WebAssinaturas.findOne({
      where: { web_veterinarios_id: vet.id }
    });
    const status = assinatura ? assinatura.status : 'inativa';

    return res.json({
      success: true,
      status,
      ativa: assinaturaAtiva(status),
      plano: assinatura ? assinatura.plano : null,
      current_period_end: assinatura ? assinatura.current_period_end : null,
      temCustomer: Boolean(vet.stripe_customer_id)
    });
  } catch (err) {
    console.error('GET /assinatura/status', err);
    return res.status(500).json({ success: false, message: 'Erro ao consultar assinatura' });
  }
});

// POST /assinatura/checkout  body: { vetId }
route.post('/assinatura/checkout', async (req, res) => {
  try {
    const { vetId } = req.body;
    const vet = await WebVeterinarios.findByPk(vetId);
    if (!vet) return res.status(404).json({ success: false, message: 'Veterinário não encontrado' });

    const customerId = await getOrCreateCustomer(vet);
    const session = await createSubscriptionCheckout(vet, customerId);
    return res.json({ success: true, url: session.url });
  } catch (err) {
    console.error('POST /assinatura/checkout', err);
    return res.status(500).json({ success: false, message: 'Erro ao iniciar assinatura' });
  }
});

// POST /assinatura/portal  body: { vetId }
route.post('/assinatura/portal', async (req, res) => {
  try {
    const { vetId } = req.body;
    const vet = await WebVeterinarios.findByPk(vetId);
    if (!vet) return res.status(404).json({ success: false, message: 'Veterinário não encontrado' });
    if (!vet.stripe_customer_id) {
      return res.status(400).json({ success: false, message: 'Nenhuma assinatura encontrada' });
    }
    const session = await createBillingPortalSession(vet.stripe_customer_id);
    return res.json({ success: true, url: session.url });
  } catch (err) {
    console.error('POST /assinatura/portal', err);
    return res.status(500).json({ success: false, message: 'Erro ao abrir portal de assinatura' });
  }
});

module.exports = route;
