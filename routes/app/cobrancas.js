'use strict';
/*
 * FINANCEIRO DO RESPONSÁVEL no app (meubixin-app).
 *
 * Porta para o app o que o Portal já faz em /portal/cobrancas e
 * /portal/cobrancas/:id/pagar, com o modelo de autenticação do app: escopo por
 * CPF (o Portal usa JWT de escopo 'portal'; o app não envia token). Mesmo
 * padrão de /app/atestados/*, /app/prescricoes/* e /app/agenda/*.
 *
 * O pagamento acontece no CHECKOUT DA STRIPE, aberto no navegador do aparelho.
 * Nenhum dado de cartão passa por este backend nem pelo app — a rota só devolve
 * a URL da sessão de checkout.
 *
 *   GET /app/cobrancas/responsavel/:cpf   cobranças em aberto e pagas
 *   GET /app/cobrancas/:id/pagar?cpf=     URL do checkout Stripe
 */
const express = require('express');
const route = express.Router();
const { QueryTypes } = require('sequelize');
const models = require('../../models');
const { sequelize, WebCobrancas, WebCobrancaItens } = models;
// ⚠️ O model do veterinário é exportado em snake_case (`web_veterinarios`), ao
// contrário dos de cobrança. Destruturar como `WebVeterinarios` devolve
// undefined e só quebra em runtime, no findByPk — foi o que aconteceu aqui.
const { web_veterinarios: WebVeterinarios } = models;
const { criarLinkCheckout } = require('../cobrancas/cobrancas');

const soDigitos = (v) => String(v || '').replace(/\D/g, '');

const CPF_SQL = `REPLACE(REPLACE(REPLACE(t.nu_cpf, '.', ''), '-', ''), ' ', '')`;

/*
 * ⚠️ 'rascunho' NUNCA chega ao responsável, e isso não é filtro de conveniência:
 * rascunho é a cobrança que o veterinário ainda está montando — valores podem
 * mudar, itens podem sair. Mostrar isso como conta a pagar seria errado.
 * 'cancelada' também fica de fora: não é devida nem foi paga, e não cabe em
 * nenhuma das duas seções da tela.
 */
const STATUS_VISIVEIS = ['pendente_pagamento', 'paga'];

function exigirCpf(valor, res) {
  const cpf = soDigitos(valor);
  if (!cpf) {
    res.status(400).json({ success: false, message: 'Informe o CPF do responsável.' });
    return null;
  }
  return cpf;
}

async function cobrancaDoTutor(cobrancaId, cpf) {
  const [linha] = await sequelize.query(
    `SELECT c.id
       FROM web_cobrancas c
       JOIN mob_animais an ON an.id = c.mob_animais_id
       JOIN mob_tutores t ON t.id = an.mob_tutores_id
      WHERE c.id = :cobrancaId
        AND ${CPF_SQL} = :cpf
        AND c.status IN (:status)
      LIMIT 1`,
    { replacements: { cobrancaId, cpf, status: STATUS_VISIVEIS }, type: QueryTypes.SELECT }
  );
  return !!linha;
}

// GET /app/cobrancas/responsavel/:cpf
route.get('/app/cobrancas/responsavel/:cpf', async (req, res) => {
  try {
    const cpf = exigirCpf(req.params.cpf, res);
    if (!cpf) return;

    const linhas = await sequelize.query(
      `SELECT c.id, c.descricao, c.status, c.total_cents, c.currency, c.createdAt,
              an.id AS animal_id, an.no_nome AS animal_nome,
              v.no_completo AS vet_nome,
              (SELECT COUNT(*) FROM web_cobranca_itens i WHERE i.web_cobrancas_id = c.id) AS qt_itens
         FROM web_cobrancas c
         JOIN mob_animais an ON an.id = c.mob_animais_id
         JOIN mob_tutores t ON t.id = an.mob_tutores_id
         LEFT JOIN web_veterinarios v ON v.id = c.web_veterinarios_id
        WHERE ${CPF_SQL} = :cpf
          AND c.status IN (:status)
        ORDER BY c.createdAt DESC
        LIMIT 100`,
      { replacements: { cpf, status: STATUS_VISIVEIS }, type: QueryTypes.SELECT }
    );

    const mapear = (c) => ({
      id: c.id,
      descricao: c.descricao || 'Cobrança',
      status: c.status,
      total_cents: c.total_cents,
      currency: c.currency,
      createdAt: c.createdAt,
      qt_itens: Number(c.qt_itens) || 0,
      animal: { id: c.animal_id, nome: c.animal_nome },
      vet_nome: c.vet_nome || null,
    });

    // Duas listas prontas — é assim que a tela mostra, e evita a tela ter de
    // conhecer o vocabulário de status do banco.
    const emAberto = linhas.filter((c) => c.status === 'pendente_pagamento').map(mapear);
    const pagas = linhas.filter((c) => c.status === 'paga').map(mapear);

    const totalEmAbertoCents = emAberto.reduce((s, c) => s + (c.total_cents || 0), 0);

    return res.json({ success: true, emAberto, pagas, totalEmAbertoCents });
  } catch (err) {
    console.error('GET /app/cobrancas/responsavel/:cpf', err);
    return res.status(500).json({ success: false, message: 'Erro ao listar as cobranças: ' + err.message });
  }
});

// GET /app/cobrancas/:id/pagar?cpf=
// Devolve a URL do checkout. O app abre no navegador do aparelho — o
// pagamento acontece na Stripe, fora do app.
route.get('/app/cobrancas/:id/pagar', async (req, res) => {
  try {
    const cpf = exigirCpf(req.query.cpf, res);
    if (!cpf) return;

    const { id } = req.params;
    if (!(await cobrancaDoTutor(id, cpf))) {
      return res.status(404).json({ success: false, message: 'Cobrança não encontrada.' });
    }

    const cobranca = await WebCobrancas.findByPk(id);
    if (!cobranca) {
      return res.status(404).json({ success: false, message: 'Cobrança não encontrada.' });
    }
    if (cobranca.status === 'paga') {
      return res.status(400).json({ success: false, message: 'Esta cobrança já foi paga.' });
    }

    const itens = await WebCobrancaItens.findAll({ where: { web_cobrancas_id: cobranca.id } });
    const vet = await WebVeterinarios.findByPk(cobranca.web_veterinarios_id);
    if (!vet) {
      return res.status(400).json({ success: false, message: 'Veterinário da cobrança não encontrado.' });
    }

    // criarLinkCheckout recusa quando o vet não concluiu o Connect da Stripe ou
    // quando a cobrança está sem itens. A mensagem dele é escrita para o VET
    // ("Conecte sua conta Stripe..."), então não pode ser repassada crua ao
    // responsável — ele não tem o que fazer com ela.
    const r = await criarLinkCheckout({ ...cobranca.toJSON(), itens }, vet);
    if (!r.success) {
      console.warn('checkout indisponível para a cobrança %s: %s', id, r.message);
      return res.status(400).json({
        success: false,
        message: 'O pagamento online ainda não está disponível para esta cobrança. Fale com a clínica.',
        motivo: r.message,
      });
    }

    return res.json({ success: true, url: r.url });
  } catch (err) {
    console.error('GET /app/cobrancas/:id/pagar', err);
    return res.status(500).json({ success: false, message: 'Erro ao gerar o pagamento: ' + err.message });
  }
});

module.exports = route;
