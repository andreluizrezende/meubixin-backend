'use strict';
const express = require('express');
const route = express.Router();
const { QueryTypes } = require('sequelize');
const models = require('../../models');
const { WebAgendamentos, WebLembretes, MolAgendaSolicitacao, sequelize } = models;
const requireAuth = require('../../middleware/requireAuth');
const { processarLembretes, gerarLembretesDose } = require('../../utils/processarLembretes');
const { emitirEnviarAcesso } = require('../../utils/portalAcesso');
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
// Retorna { gerados, motivo? } — nunca lança para casos "esperados" (passado/sem
// contato); ainda pode lançar em erro real de banco (o chamador captura e expõe).
async function gerarLembretes(ag) {
  const inicio = new Date(ag.dt_inicio).getTime();
  const agora = Date.now();
  if (inicio <= agora) return { gerados: 0, motivo: 'agendamento no passado' };
  const canais = [];
  if (ag.ds_email_responsavel) canais.push('email');
  if (ag.nu_telefone_responsavel) canais.push('whatsapp');
  if (!canais.length) return { gerados: 0, motivo: 'responsável sem e-mail/WhatsApp' };
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
  return { gerados: linhas.length };
}

// Chama gerarLembretes capturando erro real (não engole silencioso): loga o erro
// completo e devolve um objeto para a resposta da API expor o que aconteceu.
async function gerarLembretesSeguro(ag, ctx) {
  try {
    return await gerarLembretes(ag);
  } catch (e) {
    console.error(`gerarLembretes (${ctx}) FALHOU para agendamento ${ag && ag.id}:`, e);
    return { gerados: 0, erro: e.message };
  }
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

// POST /agenda/pacientes/:animalId/enviar-portal — o VET dispara o acesso ao Portal
// do Responsável (OTP + link) para o responsável do animal. Scoped por CRMV do vet.
route.post('/agenda/pacientes/:animalId/enviar-portal', async (req, res) => {
  try {
    const r = await sequelize.query(
      `SELECT t.id, t.no_completo, t.ds_email, t.nu_telefone_completo
         FROM mob_animais a
         JOIN mob_veterinarios v ON v.id = a.mob_veterinarios_id
         JOIN web_veterinarios wv ON wv.id = :vetId
         LEFT JOIN mob_tutores t ON t.id = a.mob_tutores_id
        WHERE a.id = :animalId
          AND v.nu_crmv = wv.nu_crmv AND v.ds_estado_crmv = wv.ds_estado_crmv
        LIMIT 1`,
      { replacements: { vetId: req.vetId, animalId: req.params.animalId }, type: QueryTypes.SELECT }
    );
    const tutor = r[0];
    if (!tutor || !tutor.id) return res.status(404).json({ success: false, message: 'Paciente não encontrado.' });
    if (!tutor.nu_telefone_completo && !tutor.ds_email) {
      return res.status(400).json({ success: false, message: 'O responsável não tem WhatsApp nem e-mail cadastrado.' });
    }
    const { canal, enviado } = await emitirEnviarAcesso({ tutor, canal: 'auto', ip: req.ip, userAgent: req.headers['user-agent'] });
    return res.json({ success: true, canal, enviado });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao enviar acesso ao portal: ' + err.message });
  }
});

// GET /agenda/solicitacoes — pedidos de horário PENDENTES do Portal do Responsável
// para este vet. Registrada antes de /agenda/:id para não colidir.
route.get('/agenda/solicitacoes', async (req, res) => {
  try {
    const linhas = await sequelize.query(
      `SELECT s.id, s.mob_animais_id, s.tp_agendamento, s.dt_sugerida, s.ds_motivo, s.createdAt,
              an.no_nome AS animal_nome, t.no_completo AS responsavel_nome
         FROM mol_agenda_solicitacao s
         JOIN mob_animais an ON an.id = s.mob_animais_id
         LEFT JOIN mob_tutores t ON t.id = an.mob_tutores_id
        WHERE s.web_veterinarios_id = :vetId AND s.ds_status = 'pendente'
        ORDER BY s.createdAt DESC`,
      { replacements: { vetId: req.vetId }, type: QueryTypes.SELECT }
    );
    return res.json({ success: true, itens: linhas });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao listar solicitações: ' + err.message });
  }
});

// POST /agenda/solicitacoes/:id/aceitar { dt_inicio, nu_duracao_min } — vira agendamento.
route.post('/agenda/solicitacoes/:id/aceitar', async (req, res) => {
  try {
    const sol = await MolAgendaSolicitacao.findOne({
      where: { id: req.params.id, web_veterinarios_id: req.vetId, ds_status: 'pendente' },
    });
    if (!sol) return res.status(404).json({ success: false, message: 'Solicitação não encontrada.' });
    const dtInicio = req.body && req.body.dt_inicio ? req.body.dt_inicio : sol.dt_sugerida;
    if (!dtInicio) return res.status(400).json({ success: false, message: 'Informe a data/hora do agendamento.' });

    /*
     * ⚠️ O CONTATO DO RESPONSÁVEL PRECISA VIR JUNTO, senão o agendamento nasce
     * SEM LEMBRETE NENHUM.
     *
     * `gerarLembretes` monta os canais a partir de `ds_email_responsavel` e
     * `nu_telefone_responsavel`; sem nenhum dos dois ele devolve
     * `{ gerados: 0, motivo: 'responsável sem e-mail/WhatsApp' }` e sai sem
     * criar linha. Isso NÃO derruba a rota — o agendamento é criado, a resposta
     * é 201 e ninguém percebe que o lembrete não existe.
     *
     * A rota `POST /agenda` não sofre disso porque o vet digita os contatos no
     * formulário. Aqui a solicitação vem do app e não os carrega — mas eles
     * existem em `mob_tutores`, ligados ao animal. Buscar aqui é o que faltava.
     */
    const [tutor] = await sequelize.query(
      `SELECT t.ds_email, t.nu_telefone_completo
         FROM mob_animais a
         LEFT JOIN mob_tutores t ON t.id = a.mob_tutores_id
        WHERE a.id = :animalId
        LIMIT 1`,
      { replacements: { animalId: sol.mob_animais_id }, type: QueryTypes.SELECT }
    );

    const ag = await WebAgendamentos.create({
      web_veterinarios_id: req.vetId,
      mob_animais_id: sol.mob_animais_id,
      tp_agendamento: sol.tp_agendamento || 'consulta',
      dt_inicio: dtInicio,
      nu_duracao_min: (req.body && req.body.nu_duracao_min) || 30,
      ds_titulo: sol.ds_motivo || null,
      ds_email_responsavel: (tutor && tutor.ds_email) || null,
      nu_telefone_responsavel: (tutor && tutor.nu_telefone_completo) || null,
      ds_status: 'agendado',
    });
    const lembretes = await gerarLembretesSeguro(ag, 'aceitar-solicitacao');
    await sol.update({ ds_status: 'aceita', web_agendamentos_id: ag.id });
    return res.status(201).json({ success: true, agendamento: ag, lembretes });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao aceitar solicitação: ' + err.message });
  }
});

// POST /agenda/solicitacoes/:id/recusar
route.post('/agenda/solicitacoes/:id/recusar', async (req, res) => {
  try {
    const sol = await MolAgendaSolicitacao.findOne({
      where: { id: req.params.id, web_veterinarios_id: req.vetId, ds_status: 'pendente' },
    });
    if (!sol) return res.status(404).json({ success: false, message: 'Solicitação não encontrada.' });
    await sol.update({ ds_status: 'recusada' });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao recusar solicitação: ' + err.message });
  }
});

// GET /agenda/lembretes — fila de lembretes dos agendamentos DESTE vet (tela
// temporária de validação). Registrada antes de /agenda/:id para não colidir.
route.get('/agenda/lembretes', async (req, res) => {
  try {
    const linhas = await sequelize.query(
      `SELECT l.id, l.tp_lembrete, l.tp_origem, l.canal, l.dt_agendado_para, l.dt_enviado, l.st_status, l.ds_erro,
              l.createdAt AS dt_criado,
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
              t.ds_email AS responsavel_email,
              -- Consulta gerada a partir deste agendamento (a mais recente, se o vet
              -- iniciou o atendimento mais de uma vez) e quantas cobranças ela tem.
              -- Subquery em vez de JOIN para não multiplicar linhas do calendário.
              (SELECT an2.id FROM web_anamneses an2
                WHERE an2.web_agendamentos_id = a.id
                ORDER BY an2.id DESC LIMIT 1) AS web_anamneses_id,
              (SELECT COUNT(*) FROM web_cobrancas c
                WHERE c.web_anamneses_id IN (
                  SELECT an3.id FROM web_anamneses an3 WHERE an3.web_agendamentos_id = a.id
                )) AS qt_cobrancas
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
    const lembretes = await gerarLembretesSeguro(ag, 'create');
    return res.status(201).json({ success: true, agendamento: ag, lembretes });
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
    try { await cancelarLembretesPendentes(ag.id); } catch (e) { console.error('cancelarLembretesPendentes (update):', e.message); }
    const lembretes = await gerarLembretesSeguro(ag, 'update');
    return res.json({ success: true, agendamento: ag, lembretes });
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
    const lembretes = await gerarLembretesSeguro(ret, 'retorno');
    return res.status(201).json({ success: true, agendamento: ret, lembretes });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao criar o retorno: ' + err.message });
  }
});

module.exports = route;
