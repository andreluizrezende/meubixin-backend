'use strict';
const express = require('express');
const route = express.Router();
const { QueryTypes } = require('sequelize');
const models = require('../../models');
const { WebAgendamentos, WebLembretes, sequelize } = models;
const requireAuth = require('../../middleware/requireAuth');
const { processarLembretes, gerarLembretesDose } = require('../../utils/processarLembretes');
// ---- Lembretes (Fase 2): GERAÇÃO das linhas. O MOTOR de disparo fica em
// routes/agenda/lembretes.js (rota pública via WORKER_TOKEN, montada ANTES dos
// routers com requireAuth global). Regras fixas (MVP): 24h e 2h antes.
const REGRAS_LEMBRETE = [
  { tp: 'lembrete_24h', ms: 24 * 3600 * 1000 },
  { tp: 'lembrete_2h', ms: 2 * 3600 * 1000 },
];

// Gera as linhas de web_lembretes para um agendamento futuro. Regras 24h/2h antes
// que ainda são futuras viram lembretes agendados; se o agendamento é IMINENTE
// (a menos da menor antecedência), cria um único lembrete IMEDIATO por canal —
// melhor avisar tarde do que não avisar (e permite validar na hora).
async function gerarLembretes(ag) {
  const inicio = new Date(ag.dt_inicio).getTime();
  const agora = Date.now();
  if (inicio <= agora) return; // agendamento no passado → nada
  const canais = [];
  if (ag.ds_email_responsavel) canais.push('email');
  if (ag.nu_telefone_responsavel) canais.push('whatsapp');
  if (!canais.length) return;
  const futuras = REGRAS_LEMBRETE.filter((r) => inicio - r.ms > agora);
  const linhas = [];
  for (const canal of canais) {
    if (futuras.length) {
      for (const r of futuras) {
        linhas.push({ web_agendamentos_id: ag.id, tp_lembrete: r.tp, canal, dt_agendado_para: new Date(inicio - r.ms), st_status: 'pendente' });
      }
    } else {
      // iminente: um lembrete para disparar já
      linhas.push({ web_agendamentos_id: ag.id, tp_lembrete: 'lembrete_2h', canal, dt_agendado_para: new Date(agora), st_status: 'pendente' });
    }
  }
  if (linhas.length) await WebLembretes.bulkCreate(linhas);
}

async function cancelarLembretesPendentes(agId) {
  await WebLembretes.update({ st_status: 'cancelado' }, { where: { web_agendamentos_id: agId, st_status: 'pendente' } });
}

// Todas as rotas ABAIXO exigem autenticação — a identidade é SEMPRE req.vetId
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

// GET /agenda/lembretes — fila de lembretes dos agendamentos DESTE vet (tela
// temporária de validação). Registrada antes de /agenda/:id para não colidir.
route.get('/agenda/lembretes', async (req, res) => {
  try {
    const linhas = await sequelize.query(
      `SELECT l.id, l.tp_lembrete, l.tp_origem, l.canal, l.dt_agendado_para, l.dt_enviado, l.st_status, l.ds_erro,
              a.dt_inicio, a.tp_agendamento,
              COALESCE(a.ds_titulo, l.ds_titulo) AS ds_titulo,
              an.no_nome AS animal_nome,
              COALESCE(a.ds_email_responsavel, t.ds_email) AS ds_email_responsavel,
              COALESCE(a.nu_telefone_responsavel, t.nu_telefone_completo) AS nu_telefone_responsavel
         FROM web_lembretes l
         LEFT JOIN web_agendamentos a ON a.id = l.web_agendamentos_id
         LEFT JOIN mob_animais an ON an.id = COALESCE(a.mob_animais_id, l.mob_animais_id)
         LEFT JOIN mob_tutores t ON t.id = an.mob_tutores_id
        WHERE COALESCE(a.web_veterinarios_id, l.web_veterinarios_id) = :vetId
        ORDER BY (CASE WHEN l.st_status = 'pendente' THEN 0 ELSE 1 END) ASC,
                 l.dt_agendado_para ASC, l.id ASC
        LIMIT 200`,
      { replacements: { vetId: req.vetId }, type: QueryTypes.SELECT }
    );
    return res.json({ success: true, itens: linhas });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao listar lembretes: ' + err.message });
  }
});

// POST /agenda/lembretes/disparar — disparo MANUAL (tela temporária). Processa só
// os lembretes vencidos deste vet, usando a sessão (sem expor o WORKER_TOKEN).
route.post('/agenda/lembretes/disparar', async (req, res) => {
  try {
    const r = await processarLembretes({ limite: req.body && req.body.limite, vetId: req.vetId });
    return res.json({ success: true, ...r });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao disparar lembretes: ' + err.message });
  }
});

// POST /agenda/lembretes/gerar-doses — gera lembretes de dose (vacina/vermífugo
// vencendo + medicamento do dia) para este vet. Idempotente (dedup por ds_ref).
route.post('/agenda/lembretes/gerar-doses', async (req, res) => {
  try {
    const r = await gerarLembretesDose({ vetId: req.vetId });
    return res.json({ success: true, ...r });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao gerar lembretes de dose: ' + err.message });
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
    try { await gerarLembretes(ag); } catch (e) { console.error('gerarLembretes (create):', e.message); }
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
    // Remarcou/editou → recria os lembretes pendentes com a data nova.
    try { await cancelarLembretesPendentes(ag.id); await gerarLembretes(ag); } catch (e) { console.error('gerarLembretes (update):', e.message); }
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
    // Cancelado/concluído → não faz sentido lembrar; cancela os pendentes.
    if (['cancelado', 'concluido'].includes(ds_status)) {
      try { await cancelarLembretesPendentes(ag.id); } catch (e) { console.error('cancelarLembretes:', e.message); }
    }
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
    try { await gerarLembretes(ret); } catch (e) { console.error('gerarLembretes (retorno):', e.message); }
    return res.status(201).json({ success: true, agendamento: ret });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao criar o retorno: ' + err.message });
  }
});

module.exports = route;
