'use strict';

const express = require('express');
const route = express.Router();
const models = require('../../models');
const { web_veterinarios: WebVeterinarios } = models;
const requireAuth = require('../../middleware/requireAuth');
const { getWebAppUrl } = require('../../utils/stripeClient');

// Todas as rotas de Connect exigem autenticação; a identidade vem do token.
route.use(requireAuth);
const {
  createExpressAccount,
  retrieveConnectAccount,
  createAccountOnboardingLink,
  createAccountUpdateLink,
  shouldUseAccountUpdateLink,
  mapAccountToFlags
} = require('../../utils/stripeConnect');

// Resumo do estado de onboarding/recebimento do veterinário.
function statusPayload(vet) {
  return {
    connected: Boolean(vet.stripe_connect_account_id),
    charges_enabled: Boolean(vet.stripe_charges_enabled),
    details_submitted: Boolean(vet.stripe_details_submitted)
  };
}

// GET /connect/status/:vetId  (o :vetId é ignorado; usa-se o id do token)
route.get('/connect/status/:vetId', async (req, res) => {
  try {
    const vet = await WebVeterinarios.findByPk(req.vetId);
    if (!vet) return res.status(404).json({ success: false, message: 'Veterinário não encontrado' });
    return res.json({ success: true, ...statusPayload(vet) });
  } catch (err) {
    console.error('GET /connect/status', err);
    return res.status(500).json({ success: false, message: 'Erro ao consultar status' });
  }
});

// POST /connect/onboarding  body: { vetId }
// Cria a conta Express se necessário e devolve a URL do account link.
route.post('/connect/onboarding', async (req, res) => {
  try {
    const vet = await WebVeterinarios.findByPk(req.vetId);
    if (!vet) return res.status(404).json({ success: false, message: 'Veterinário não encontrado' });

    let accountId = vet.stripe_connect_account_id;
    if (!accountId) {
      const account = await createExpressAccount(vet);
      accountId = account.id;
      await WebVeterinarios.update(
        { stripe_connect_account_id: accountId },
        { where: { id: vet.id } }
      );
    }

    const account = await retrieveConnectAccount(accountId);
    const web = getWebAppUrl();
    const refreshUrl = `${web}/pagamentos?connect=refresh`;
    const returnUrl = `${web}/pagamentos?connect=return`;

    const link = shouldUseAccountUpdateLink(account)
      ? await createAccountUpdateLink(accountId, refreshUrl, returnUrl)
      : await createAccountOnboardingLink(accountId, refreshUrl, returnUrl);

    return res.json({ success: true, url: link.url });
  } catch (err) {
    console.error('POST /connect/onboarding', err);
    return res.status(500).json({ success: false, message: 'Erro ao iniciar onboarding' });
  }
});

// POST /connect/sincronizar  body: { vetId }
// Refaz accounts.retrieve e atualiza as flags localmente.
route.post('/connect/sincronizar', async (req, res) => {
  try {
    const vet = await WebVeterinarios.findByPk(req.vetId);
    if (!vet) return res.status(404).json({ success: false, message: 'Veterinário não encontrado' });
    if (!vet.stripe_connect_account_id) {
      return res.status(400).json({ success: false, message: 'Conta Stripe ainda não conectada' });
    }

    const account = await retrieveConnectAccount(vet.stripe_connect_account_id);
    const flags = mapAccountToFlags(account);
    await WebVeterinarios.update(flags, { where: { id: vet.id } });

    // Resposta no mesmo formato do GET /connect/status (charges_enabled/
    // details_submitted, sem o prefixo stripe_) — o frontend lê esses nomes.
    return res.json({
      success: true,
      connected: true,
      charges_enabled: Boolean(account.charges_enabled),
      details_submitted: Boolean(account.details_submitted)
    });
  } catch (err) {
    console.error('POST /connect/sincronizar', err);
    return res.status(500).json({ success: false, message: 'Erro ao sincronizar status' });
  }
});

module.exports = route;
