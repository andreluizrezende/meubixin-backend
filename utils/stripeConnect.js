'use strict';

const { getStripe, getDefaultConnectCountry } = require('./stripeClient');

/**
 * Cria uma conta Stripe Connect Express para o veterinário.
 * @param {object} vet - registro web_veterinarios (precisa de id e ds_email)
 */
async function createExpressAccount(vet) {
  const stripe = getStripe();
  return stripe.accounts.create({
    type: 'express',
    country: getDefaultConnectCountry(),
    email: vet.ds_email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true }
    },
    metadata: { web_veterinarios_id: String(vet.id) }
  });
}

/** Recupera a conta conectada na Stripe. */
async function retrieveConnectAccount(accountId) {
  return getStripe().accounts.retrieve(accountId);
}

/** Cria o link de onboarding inicial da conta Express. */
async function createAccountOnboardingLink(accountId, refreshUrl, returnUrl) {
  return getStripe().accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding'
  });
}

/** Cria link para atualizar dados de uma conta já existente. */
async function createAccountUpdateLink(accountId, refreshUrl, returnUrl) {
  return getStripe().accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_update'
  });
}

/**
 * Decide se deve usar link de update (já submeteu detalhes) ou onboarding.
 *
 * Contas Express com coleta de requisitos gerenciada pelo Stripe
 * (controller.requirement_collection === 'stripe') NÃO aceitam Account Links
 * do tipo `account_update` — a Stripe só permite `account_onboarding`, que
 * também serve para revisar/atualizar dados. Nesses casos retornamos false.
 */
function shouldUseAccountUpdateLink(account) {
  if (!account || !account.details_submitted) return false;
  const collection = account.controller && account.controller.requirement_collection;
  if (collection === 'stripe') return false;
  return true;
}

/** Mapeia uma conta Stripe para as flags persistidas em web_veterinarios. */
function mapAccountToFlags(account) {
  return {
    stripe_charges_enabled: Boolean(account.charges_enabled),
    stripe_details_submitted: Boolean(account.details_submitted)
  };
}

module.exports = {
  createExpressAccount,
  retrieveConnectAccount,
  createAccountOnboardingLink,
  createAccountUpdateLink,
  shouldUseAccountUpdateLink,
  mapAccountToFlags
};
