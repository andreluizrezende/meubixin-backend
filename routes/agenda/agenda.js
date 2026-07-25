'use strict';
const express = require('express');
const route = express.Router();
const { QueryTypes } = require('sequelize');
const models = require('../../models');
const { WebAgendamentos, sequelize } = models;
const requireAuth = require('../../middleware/requireAuth');

// Todas as rotas da agenda exigem autenticação — a identidade é SEMPRE req.vetId
// (nunca um vetId vindo do corpo/query). Ver gotcha de montagem no index.js:
// este router é montado por ÚLTIMO, depois de connect/cobrancas/assinatura.
route.use(requireAuth);

const STATUS = ['agendado', 'confirmado', 'concluido', 'cancelado', 'faltou'];
const TIPOS = ['consulta', 'retorno', 'vacina', 'procedimento', 'teleconsulta'];

// Normaliza os campos editáveis vindos do corpo (ignora o que não for permitido).
function camposEditaveis(body) {
  const out = {};
  if (body.tp_agendamento != null) out.tp_agendamento = TIPOS.includes(body.tp_agendamento) ? body.tp_agendamento : 'consulta';
  if (body.dt_inicio != null) out.dt_inicio = new Date(body.dt_inicio);
  if (body.nu_duracao_min != null) out.nu_duracao_min = Number(body.nu_duracao_min) || 30;
  if (body.ds_titulo !== undefined) out.ds_titulo = body.ds_titulo || null;
  if (body.ds_local !== undefined) out.ds_local = body.ds_local || null;
  if (body.ds_email_responsavel !== undefined) out.ds_email_responsavel = body.ds_email_responsavel || null;
  if (body.nu_telefone_responsavel !== undefined) out.nu_telefone_responsavel = body.nu_telefone_responsavel || null;
  if (body.ds_observacoes !== undefined) out.ds_observacoes = body.ds_observacoes || null;
  return out;
}

// GET /agenda/pacientes — animais do VET LOGADO (associação por CRMV), já com os
// contatos do responsável e a data da última consulta (web_anamneses) feita por
// este veterinário. Scoped por req.vetId (nunca por parâmetro do cliente).
route.get('/agenda/pacientes', async (req, res) => {
  try {
    const linhas = await sequelize.query(
      `SELECT a.id, a.no_nome, a.ds_especie, a.mob_tutores_id,
              t.no_completo            AS responsavel_nome,
              t.ds_email               AS responsavel_email,
              t.nu_telefone_completo   AS responsavel_telefone,
              (SELECT MAX(COALESCE(an.dt_data_anamnese, an.createdAt))
                 FROM web_anamneses an
                WHERE an.mob_animais_id = a.id
                  AND an.web_veterinarios_id = :vetId) AS ultima_consulta
         FROM mob_animais a
         JOIN mob_veterinarios v ON v.id = a.mob_veterinarios_id
         JOIN web_veterinarios wv ON wv.id = :vetId
         LEFT JOIN mob_tutores t ON t.id = a.mob_tutores_id
        WHERE v.nu_crmv = wv.nu_crmv
          AND v.ds_estado_crmv = wv.ds_estado_crmv
        ORDER BY a.no_nome ASC`,
      { replacements: { vetId: req.vetId }, type: QueryTypes.SELECT }
    );
    return res.json({ success: true, itens: linhas });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao listar pacientes: ' + err.message });
  }
});

// GET /agenda?de=YYYY-MM-DD&ate=YYYY-MM-DD  — lista os agendamentos do vet no
// intervalo (para o calendário). Inclui nome/espécie do animal e o responsável.
route.get('/agenda', async (req, res) => {
  try {
    const hoje = new Date();
    const de = req.query.de ? new Date(req.query.de) : new Date(hoje.getTime() - 24 * 3600 * 1000);
    const ate = req.query.ate ? new Date(req.query.ate) : new Date(hoje.getTime() + 60 * 24 * 3600 * 1000);
    const linhas = await sequelize.query(
      `SELECT a.*, an.no_nome AS animal_nome, an.ds_especie AS animal_especie,
              t.no_completo AS responsavel_nome, t.nu_telefone_completo AS responsavel_telefone,
              t.ds_email AS responsavel_email
         FROM web_agendamentos a
         JOIN mob_animais an ON an.id = a.mob_animais_id
         LEFT JOIN mob_tutores t ON t.id = an.mob_tutores_id
        WHERE a.web_veterinarios_id = :vetId
          AND a.dt_inicio BETWEEN :de AND :ate
        ORDER BY a.dt_inicio ASC`,
      { replacements: { vetId: req.vetId, de, ate }, type: QueryTypes.SELECT }
    );
    return res.json({ success: true, itens: linhas });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao listar a agenda: ' + err.message });
  }
});

// GET /agenda/:id — detalhe de um agendamento do vet.
route.get('/agenda/:id', async (req, res) => {
  try {
    const ag = await WebAgendamentos.findOne({ where: { id: req.params.id, web_veterinarios_id: req.vetId } });
    if (!ag) return res.status(404).json({ success: false, message: 'Agendamento não encontrado.' });
    return res.json({ success: true, agendamento: ag });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao carregar o agendamento: ' + err.message });
  }
});

// POST /agenda — cria um agendamento.
route.post('/agenda', async (req, res) => {
  try {
    const { mob_animais_id, dt_inicio } = req.body;
    if (!mob_animais_id) return res.status(400).json({ success: false, message: 'Informe o paciente (mob_animais_id).' });
    if (!dt_inicio) return res.status(400).json({ success: false, message: 'Informe a data/hora (dt_inicio).' });

    const dados = camposEditaveis(req.body);
    const ag = await WebAgendamentos.create({
      web_veterinarios_id: req.vetId,
      mob_animais_id,
      tp_agendamento: dados.tp_agendamento || 'consulta',
      dt_inicio: dados.dt_inicio,
      nu_duracao_min: dados.nu_duracao_min || 30,
      ds_titulo: dados.ds_titulo || null,
      ds_local: dados.ds_local || null,
      ds_email_responsavel: dados.ds_email_responsavel || null,
      nu_telefone_responsavel: dados.nu_telefone_responsavel || null,
      ds_observacoes: dados.ds_observacoes || null,
      ds_status: 'agendado',
    });
    // TODO (Fase 2): gerar linhas em web_lembretes (24h/2h antes) a partir de dt_inicio.
    return res.status(201).json({ success: true, agendamento: ag });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao criar o agendamento: ' + err.message });
  }
});

// PUT /agenda/:id — edita/remarca (só se for do vet).
route.put('/agenda/:id', async (req, res) => {
  try {
    const ag = await WebAgendamentos.findOne({ where: { id: req.params.id, web_veterinarios_id: req.vetId } });
    if (!ag) return res.status(404).json({ success: false, message: 'Agendamento não encontrado.' });
    await ag.update(camposEditaveis(req.body));
    // TODO (Fase 2): recalcular os lembretes pendentes se dt_inicio mudou.
    return res.json({ success: true, agendamento: ag });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao atualizar o agendamento: ' + err.message });
  }
});

// PATCH /agenda/:id/status — confirmar/concluir/cancelar/faltou.
route.patch('/agenda/:id/status', async (req, res) => {
  try {
    const { ds_status } = req.body;
    if (!STATUS.includes(ds_status)) {
      return res.status(400).json({ success: false, message: 'Status inválido. Use: ' + STATUS.join(', ') });
    }
    const ag = await WebAgendamentos.findOne({ where: { id: req.params.id, web_veterinarios_id: req.vetId } });
    if (!ag) return res.status(404).json({ success: false, message: 'Agendamento não encontrado.' });
    await ag.update({ ds_status });
    return res.json({ success: true, agendamento: ag });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao mudar o status: ' + err.message });
  }
});

// POST /agenda/:id/retorno — cria um retorno a partir de um agendamento existente.
route.post('/agenda/:id/retorno', async (req, res) => {
  try {
    const { dt_inicio } = req.body;
    if (!dt_inicio) return res.status(400).json({ success: false, message: 'Informe a data/hora do retorno (dt_inicio).' });
    const orig = await WebAgendamentos.findOne({ where: { id: req.params.id, web_veterinarios_id: req.vetId } });
    if (!orig) return res.status(404).json({ success: false, message: 'Agendamento de origem não encontrado.' });
    const ret = await WebAgendamentos.create({
      web_veterinarios_id: req.vetId,
      mob_animais_id: orig.mob_animais_id,
      tp_agendamento: 'retorno',
      dt_inicio: new Date(dt_inicio),
      nu_duracao_min: orig.nu_duracao_min,
      ds_titulo: req.body.ds_titulo || 'Retorno',
      ds_local: orig.ds_local,
      ds_email_responsavel: orig.ds_email_responsavel,
      nu_telefone_responsavel: orig.nu_telefone_responsavel,
      ds_observacoes: req.body.ds_observacoes || null,
      ds_status: 'agendado',
    });
    return res.status(201).json({ success: true, agendamento: ret });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao criar o retorno: ' + err.message });
  }
});

module.exports = route;
