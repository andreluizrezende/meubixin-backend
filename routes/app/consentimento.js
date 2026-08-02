'use strict';
/*
 * CONTA E PREFERÊNCIAS (LGPD) do responsável no app (meubixin-app).
 *
 * Porta para o app o que o Portal faz em GET|PUT /portal/consentimento, com o
 * modelo de autenticação do app: escopo por CPF. Sexto consumidor do /app/.
 *
 * O que se controla aqui é POR CANAL: e-mail, WhatsApp e marketing são chaves
 * independentes. Desligar marketing NÃO desliga os avisos de saúde (lembrete de
 * dose, retorno) — é exatamente essa separação que dá sentido ao consentimento.
 *
 *   GET /app/consentimento/:cpf
 *   PUT /app/consentimento/:cpf   { st_email, st_whatsapp, st_marketing }
 *
 * ⚠️ AUSÊNCIA DE LINHA = TUDO PERMITIDO. É a convenção do módulo de Retenção, e
 * não pode ser invertida aqui sem quebrar quem já lê `web_consentimento`.
 *
 * ⚠️⚠️ O MESMO CPF PODE TER VÁRIAS LINHAS EM `mob_tutores` — verificado no dev,
 * onde um CPF aparece 8 vezes. Como `web_consentimento` é chaveado por
 * `mob_tutores_id` (unique), e os motores de lembrete/retenção leem por esse id,
 * tratar só um dos ids deixaria os outros recebendo mensagem depois do opt-out.
 * Por isso, aqui:
 *   - na LEITURA, vence o MAIS RESTRITIVO (se qualquer linha nega, responde nega);
 *   - na ESCRITA, aplica-se a TODAS as linhas daquele CPF.
 * O Portal não tem esse problema porque identifica o tutor por id, não por CPF.
 */
const express = require('express');
const route = express.Router();
const { QueryTypes } = require('sequelize');
const models = require('../../models');
const { sequelize, WebConsentimento } = models;

const soDigitos = (v) => String(v || '').replace(/\D/g, '');

const CPF_SQL = `REPLACE(REPLACE(REPLACE(nu_cpf, '.', ''), '-', ''), ' ', '')`;

const CHAVES = ['st_email', 'st_whatsapp', 'st_marketing'];

function exigirCpf(valor, res) {
  const cpf = soDigitos(valor);
  if (!cpf) {
    res.status(400).json({ success: false, message: 'Informe o CPF do responsável.' });
    return null;
  }
  return cpf;
}

async function tutoresDoCpf(cpf) {
  const linhas = await sequelize.query(
    `SELECT id, no_completo, ds_email, nu_telefone_completo
       FROM mob_tutores
      WHERE ${CPF_SQL} = :cpf`,
    { replacements: { cpf }, type: QueryTypes.SELECT }
  );
  return linhas;
}

// GET /app/consentimento/:cpf
route.get('/app/consentimento/:cpf', async (req, res) => {
  try {
    const cpf = exigirCpf(req.params.cpf, res);
    if (!cpf) return;

    const tutores = await tutoresDoCpf(cpf);
    if (tutores.length === 0) {
      return res.status(404).json({ success: false, message: 'Responsável não encontrado.' });
    }

    const ids = tutores.map((t) => t.id);
    const registros = await WebConsentimento.findAll({ where: { mob_tutores_id: ids } });

    // Mais restritivo vence: basta uma linha negar para a resposta ser "não".
    // Sem linha, permanece permitido (convenção do módulo de Retenção).
    const consentimento = {};
    for (const chave of CHAVES) {
      const algumNegou = registros.some((r) => Number(r[chave]) === 0);
      consentimento[chave] = algumNegou ? 0 : 1;
    }

    // O contato vem junto porque a tela mostra os dois na mesma seção — evita
    // uma segunda chamada só para exibir e-mail e telefone.
    const principal = tutores[0];

    return res.json({
      success: true,
      consentimento,
      contato: {
        nome: principal.no_completo,
        email: principal.ds_email,
        telefone: principal.nu_telefone_completo,
      },
      // Exposto para depuração: quantos registros de tutor este CPF alcança.
      qt_tutores: tutores.length,
    });
  } catch (err) {
    console.error('GET /app/consentimento/:cpf', err);
    return res.status(500).json({ success: false, message: 'Erro ao ler as preferências: ' + err.message });
  }
});

// PUT /app/consentimento/:cpf
route.put('/app/consentimento/:cpf', async (req, res) => {
  try {
    const cpf = exigirCpf(req.params.cpf, res);
    if (!cpf) return;

    const tutores = await tutoresDoCpf(cpf);
    if (tutores.length === 0) {
      return res.status(404).json({ success: false, message: 'Responsável não encontrado.' });
    }

    const corpo = req.body || {};
    // Só entra o que veio; o que não veio mantém o valor atual — assim a tela
    // pode mandar uma chave só sem zerar as outras sem querer.
    const mudancas = {};
    for (const chave of CHAVES) {
      if (corpo[chave] !== undefined && corpo[chave] !== null) {
        mudancas[chave] = Number(corpo[chave]) ? 1 : 0;
      }
    }
    if (Object.keys(mudancas).length === 0) {
      return res.status(400).json({ success: false, message: 'Nada para atualizar.' });
    }

    // Aplica a TODAS as linhas do CPF — ver o aviso no topo do arquivo.
    for (const tutor of tutores) {
      const existente = await WebConsentimento.findOne({ where: { mob_tutores_id: tutor.id } });
      if (existente) {
        await existente.update(mudancas);
      } else {
        await WebConsentimento.create({
          mob_tutores_id: tutor.id,
          // Sem linha, o padrão é permitido — então o que não foi mudado nasce 1.
          st_email: 1,
          st_whatsapp: 1,
          st_marketing: 1,
          ...mudancas,
        });
      }
    }

    const ids = tutores.map((t) => t.id);
    const registros = await WebConsentimento.findAll({ where: { mob_tutores_id: ids } });
    const consentimento = {};
    for (const chave of CHAVES) {
      consentimento[chave] = registros.some((r) => Number(r[chave]) === 0) ? 0 : 1;
    }

    return res.json({ success: true, consentimento, tutores_afetados: tutores.length });
  } catch (err) {
    console.error('PUT /app/consentimento/:cpf', err);
    return res.status(500).json({ success: false, message: 'Erro ao salvar as preferências: ' + err.message });
  }
});

module.exports = route;
