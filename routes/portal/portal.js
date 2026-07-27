'use strict';
// Portal do Responsável (app mobile / PWA) — rotas PÚBLICAS com auth própria (token
// de escopo 'portal', NÃO o requireAuth do vet). Montar ANTES dos routers com
// requireAuth no index.js. Identidade = req.tutorId (via requirePortal), nunca do corpo.
const express = require('express');
const crypto = require('crypto');
const route = express.Router();
const { QueryTypes } = require('sequelize');
const models = require('../../models');
const { MolResponsavelSessao, sequelize } = models;
const requirePortal = require('../../middleware/requirePortal');
const { signPortalToken } = require('../../utils/portalToken');
const { enviarEmail, enviarWhatsApp } = require('../../utils/notificacoes');

const APP_URL = process.env.WEB_APP_URL || process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
const OTP_MIN = 15; // validade do código/link em minutos

const soDigitos = (s) => String(s || '').replace(/\D/g, '');
const gerarCodigo = () => String(Math.floor(100000 + Math.random() * 900000));
const gerarToken = () => crypto.randomBytes(24).toString('hex');

// Acha o responsável (mob_tutores) por e-mail OU telefone. Telefone compara pelos
// últimos 8+ dígitos (tolerante a DDI/DDD/formatação).
async function acharResponsavel(contato) {
  const c = String(contato || '').trim();
  if (!c) return null;
  if (c.includes('@')) {
    const r = await sequelize.query(
      'SELECT id, no_completo, ds_email, nu_telefone_completo FROM mob_tutores WHERE LOWER(ds_email) = LOWER(:c) LIMIT 1',
      { replacements: { c }, type: QueryTypes.SELECT }
    );
    return r[0] || null;
  }
  const dig = soDigitos(c);
  if (dig.length < 8) return null;
  const sufixo = dig.slice(-8);
  const r = await sequelize.query(
    `SELECT id, no_completo, ds_email, nu_telefone_completo FROM mob_tutores
      WHERE REPLACE(REPLACE(REPLACE(REPLACE(nu_telefone_completo,'(',''),')',''),'-',''),' ','') LIKE :suf
      LIMIT 1`,
    { replacements: { suf: '%' + sufixo }, type: QueryTypes.SELECT }
  );
  return r[0] || null;
}

// POST /portal/solicitar-acesso { contato } — gera OTP + link e envia no canal.
// Responde SEMPRE 200 (não revela se o contato existe).
route.post('/portal/solicitar-acesso', async (req, res) => {
  const contato = (req.body && req.body.contato) || '';
  const generico = { success: true, message: 'Se o contato estiver cadastrado, enviaremos o acesso.' };
  try {
    const resp = await acharResponsavel(contato);
    if (!resp) return res.json(generico);

    // anti-spam simples: reusa um código emitido há < 60s, se houver.
    const recente = await MolResponsavelSessao.findOne({
      where: { mob_tutores_id: resp.id, usado_em: null },
      order: [['createdAt', 'DESC']],
    });
    let codigo, token;
    const agora = Date.now();
    if (recente && agora - new Date(recente.createdAt).getTime() < 60000) {
      codigo = recente.codigo; token = recente.token;
    } else {
      codigo = gerarCodigo(); token = gerarToken();
      await MolResponsavelSessao.create({
        mob_tutores_id: resp.id, codigo, token,
        canal: contato.includes('@') ? 'email' : 'whatsapp',
        dt_expira: new Date(agora + OTP_MIN * 60000),
        ip: req.ip, user_agent: String(req.headers['user-agent'] || '').slice(0, 255),
      });
    }

    const link = `${APP_URL}/portal/entrar?t=${token}`;
    const primeiroNome = String(resp.no_completo || 'Responsável').split(' ')[0];
    if (contato.includes('@')) {
      if (resp.ds_email) {
        await enviarEmail({
          para: resp.ds_email,
          assunto: 'Seu acesso ao Portal — Meu Bixin',
          html: `<p>Olá, ${primeiroNome}!</p><p>Seu código de acesso é <b style="font-size:20px">${codigo}</b> (válido por ${OTP_MIN} min).</p><p>Ou entre direto: <a href="${link}">abrir o portal</a>.</p>`,
          texto: `Olá, ${primeiroNome}! Seu código de acesso é ${codigo} (válido por ${OTP_MIN} min). Ou acesse: ${link}`,
        }).catch((e) => console.error('[portal] email:', e.message));
      }
    } else if (resp.nu_telefone_completo) {
      await enviarWhatsApp({
        telefone: resp.nu_telefone_completo,
        texto: `Olá, ${primeiroNome}! 🐾\nSeu código de acesso ao Portal Meu Bixin é *${codigo}* (válido por ${OTP_MIN} min).\nOu acesse direto: ${link}`,
      }).catch((e) => console.error('[portal] whatsapp:', e.message));
    }
    return res.json(generico);
  } catch (err) {
    console.error('[portal] solicitar-acesso:', err.message);
    return res.json(generico); // não vaza erro/existência
  }
});

// POST /portal/validar { contato, codigo } OU { token } — valida e emite o JWT do portal.
route.post('/portal/validar', async (req, res) => {
  try {
    const { contato, codigo, token } = req.body || {};
    let linha = null;
    if (token) {
      linha = await MolResponsavelSessao.findOne({ where: { token: String(token) } });
    } else if (contato && codigo) {
      const resp = await acharResponsavel(contato);
      if (resp) {
        linha = await MolResponsavelSessao.findOne({
          where: { mob_tutores_id: resp.id, codigo: String(codigo).trim() },
          order: [['createdAt', 'DESC']],
        });
      }
    }
    if (!linha) return res.status(400).json({ success: false, message: 'Código inválido.' });
    if (linha.usado_em) return res.status(400).json({ success: false, message: 'Este acesso já foi usado. Peça um novo.' });
    if (new Date(linha.dt_expira).getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: 'Acesso expirado. Peça um novo.' });
    }
    await linha.update({ usado_em: new Date() });

    const jwtPortal = signPortalToken(linha.mob_tutores_id);
    const resp = await sequelize.query(
      'SELECT no_completo FROM mob_tutores WHERE id = :id LIMIT 1',
      { replacements: { id: linha.mob_tutores_id }, type: QueryTypes.SELECT }
    );
    return res.json({ success: true, token: jwtPortal, responsavel: { nome: (resp[0] && resp[0].no_completo) || null } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao validar acesso: ' + err.message });
  }
});

// ---- Rotas autenticadas do portal (requirePortal → req.tutorId) ----

// Confirma que o animal pertence ao responsável logado.
async function petDoResponsavel(animalId, tutorId) {
  const r = await sequelize.query(
    'SELECT id FROM mob_animais WHERE id = :id AND mob_tutores_id = :tutorId LIMIT 1',
    { replacements: { id: animalId, tutorId }, type: QueryTypes.SELECT }
  );
  return r.length > 0;
}

// GET /portal/me — dados do responsável logado.
route.get('/portal/me', requirePortal, async (req, res) => {
  try {
    const r = await sequelize.query(
      'SELECT id, no_completo AS nome, ds_email AS email, nu_telefone_completo AS telefone FROM mob_tutores WHERE id = :id LIMIT 1',
      { replacements: { id: req.tutorId }, type: QueryTypes.SELECT }
    );
    return res.json({ success: true, responsavel: r[0] || null });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro: ' + err.message });
  }
});

// GET /portal/pets — animais do responsável + perfil + nº de doses vencidas.
route.get('/portal/pets', requirePortal, async (req, res) => {
  try {
    const linhas = await sequelize.query(
      `SELECT a.id, a.no_nome AS nome, a.ds_especie AS especie, a.ds_sexo AS sexo,
              a.vl_idade AS idade, a.vl_peso AS peso,
              p.ds_raca AS raca, p.dt_nascimento AS nascimento, p.ds_porte AS porte,
              p.st_castrado AS castrado, p.ds_doencas_cronicas AS doencas,
              (SELECT COUNT(*) FROM web_protocolos_agendas pa
                 JOIN web_protocolos wp ON wp.id = pa.web_protocolos_id
                 JOIN web_anamneses an ON an.id = wp.web_anamneses_id
                WHERE an.mob_animais_id = a.id AND pa.st_concluido = 0
                  AND pa.dt_data_aplicacao < NOW()) AS doses_vencidas
         FROM mob_animais a
         LEFT JOIN web_pet_perfil p ON p.mob_animais_id = a.id
        WHERE a.mob_tutores_id = :tutorId
        ORDER BY a.no_nome ASC`,
      { replacements: { tutorId: req.tutorId }, type: QueryTypes.SELECT }
    );
    return res.json({ success: true, itens: linhas });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao listar pets: ' + err.message });
  }
});

const TIPO_DOSE = { 0: 'Vacina', 1: 'Medicamento', 2: 'Vermífugo' };

// GET /portal/pets/:id/vacinas — doses (vacina/vermífugo/medicamento) do pet, com situação.
route.get('/portal/pets/:id/vacinas', requirePortal, async (req, res) => {
  try {
    if (!(await petDoResponsavel(req.params.id, req.tutorId))) {
      return res.status(404).json({ success: false, message: 'Pet não encontrado.' });
    }
    const linhas = await sequelize.query(
      `SELECT pa.id, pa.dt_data_aplicacao AS data, pa.st_concluido AS concluido,
              wp.st_tipo_protocolo AS tipo,
              COALESCE(wp.nome_protocolo, ps.ds_protocolos_saude) AS nome
         FROM web_protocolos_agendas pa
         JOIN web_protocolos wp ON wp.id = pa.web_protocolos_id
         JOIN web_anamneses an ON an.id = wp.web_anamneses_id
         LEFT JOIN web_protocolos_saude ps ON ps.id = wp.web_protocolos_saude_id
        WHERE an.mob_animais_id = :animalId
        ORDER BY pa.dt_data_aplicacao ASC`,
      { replacements: { animalId: req.params.id }, type: QueryTypes.SELECT }
    );
    const agora = Date.now();
    const itens = linhas.map((l) => ({
      id: l.id,
      nome: l.nome,
      tipoLabel: TIPO_DOSE[l.tipo] || 'Dose',
      data: l.data,
      situacao: l.concluido === 1 ? 'aplicada'
        : (l.data && new Date(l.data).getTime() < agora ? 'vencida' : 'proxima'),
    }));
    return res.json({ success: true, itens });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao carregar vacinas: ' + err.message });
  }
});

// GET /portal/pets/:id/historico — consultas (web_anamneses) do pet, com nº de prescrições.
route.get('/portal/pets/:id/historico', requirePortal, async (req, res) => {
  try {
    if (!(await petDoResponsavel(req.params.id, req.tutorId))) {
      return res.status(404).json({ success: false, message: 'Pet não encontrado.' });
    }
    const linhas = await sequelize.query(
      `SELECT an.id, COALESCE(an.dt_data_anamnese, an.createdAt) AS data,
              (SELECT COUNT(*) FROM web_protocolos wp WHERE wp.web_anamneses_id = an.id) AS qtd_protocolos
         FROM web_anamneses an
        WHERE an.mob_animais_id = :animalId
        ORDER BY data DESC
        LIMIT 50`,
      { replacements: { animalId: req.params.id }, type: QueryTypes.SELECT }
    );
    return res.json({ success: true, itens: linhas });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao carregar histórico: ' + err.message });
  }
});

module.exports = route;
