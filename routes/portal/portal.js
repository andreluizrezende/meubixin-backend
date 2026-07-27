'use strict';
// Portal do Responsável (app mobile / PWA) — rotas PÚBLICAS com auth própria (token
// de escopo 'portal', NÃO o requireAuth do vet). Montar ANTES dos routers com
// requireAuth no index.js. Identidade = req.tutorId (via requirePortal), nunca do corpo.
const express = require('express');
const route = express.Router();
const { QueryTypes } = require('sequelize');
const models = require('../../models');
const { MolResponsavelSessao, MolAgendaSolicitacao, WebConsentimento, WebCobrancas, WebCobrancaItens, sequelize } = models;
const { web_veterinarios: WebVeterinarios } = models;
const requirePortal = require('../../middleware/requirePortal');
const { signPortalToken } = require('../../utils/portalToken');
const { emitirEnviarAcesso } = require('../../utils/portalAcesso');
const { getSignedUrlForDownload } = require('../../utils/s3_teste');
const { criarLinkCheckout } = require('../cobrancas/cobrancas');

const soDigitos = (s) => String(s || '').replace(/\D/g, '');

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
    // envia pelo mesmo tipo de contato informado (e-mail vs telefone).
    await emitirEnviarAcesso({
      tutor: resp,
      canal: contato.includes('@') ? 'email' : 'whatsapp',
      ip: req.ip, userAgent: req.headers['user-agent'],
    });
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
              (SELECT COUNT(*) FROM web_protocolos wp WHERE wp.web_anamneses_id = an.id) AS qtd_protocolos,
              EXISTS(SELECT 1 FROM web_registros_prescricoes rp
                      WHERE rp.web_anamneses_id = an.id AND rp.status = 'assinada'
                        AND rp.arquivo_s3_path IS NOT NULL) AS receita_assinada
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

// GET /portal/pets/:id/consultas/:anamneseId/receita — URL assinada (S3) do PDF da
// receita assinada digitalmente. Escopado: o pet é do responsável E a consulta é do pet.
route.get('/portal/pets/:id/consultas/:anamneseId/receita', requirePortal, async (req, res) => {
  try {
    if (!(await petDoResponsavel(req.params.id, req.tutorId))) {
      return res.status(404).json({ success: false, message: 'Pet não encontrado.' });
    }
    // a consulta precisa pertencer a este pet
    const an = await sequelize.query(
      'SELECT id FROM web_anamneses WHERE id = :anId AND mob_animais_id = :petId LIMIT 1',
      { replacements: { anId: req.params.anamneseId, petId: req.params.id }, type: QueryTypes.SELECT }
    );
    if (!an.length) return res.status(404).json({ success: false, message: 'Consulta não encontrada.' });

    const reg = await sequelize.query(
      `SELECT arquivo_s3_path, codigo_verificacao FROM web_registros_prescricoes
        WHERE web_anamneses_id = :anId AND status = 'assinada' AND arquivo_s3_path IS NOT NULL
        ORDER BY id DESC LIMIT 1`,
      { replacements: { anId: req.params.anamneseId }, type: QueryTypes.SELECT }
    );
    if (!reg.length) return res.status(404).json({ success: false, message: 'Receita assinada não encontrada.' });

    const urlData = await getSignedUrlForDownload(reg[0].arquivo_s3_path, 3600);
    return res.json({
      success: true,
      url: urlData.url,
      fileName: `receita-${reg[0].codigo_verificacao || req.params.anamneseId}.pdf`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao obter a receita: ' + err.message });
  }
});

// ---- Fase 2: consentimento (LGPD) ----

// GET /portal/consentimento — estado atual (ausência de linha = tudo permitido).
route.get('/portal/consentimento', requirePortal, async (req, res) => {
  try {
    const c = await WebConsentimento.findOne({ where: { mob_tutores_id: req.tutorId } });
    return res.json({
      success: true,
      consentimento: {
        st_email: c ? c.st_email : 1,
        st_whatsapp: c ? c.st_whatsapp : 1,
        st_marketing: c ? c.st_marketing : 1,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao ler consentimento: ' + err.message });
  }
});

// PUT /portal/consentimento — o próprio responsável ajusta seus opt-ins.
route.put('/portal/consentimento', requirePortal, async (req, res) => {
  try {
    const { st_email, st_whatsapp, st_marketing } = req.body || {};
    const dados = {
      mob_tutores_id: req.tutorId,
      st_email: st_email != null ? Number(st_email) : 1,
      st_whatsapp: st_whatsapp != null ? Number(st_whatsapp) : 1,
      st_marketing: st_marketing != null ? Number(st_marketing) : 1,
    };
    const existente = await WebConsentimento.findOne({ where: { mob_tutores_id: req.tutorId } });
    if (existente) await existente.update(dados); else await WebConsentimento.create(dados);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao salvar consentimento: ' + err.message });
  }
});

// ---- Fase 2: cobranças + pagamento ----

// GET /portal/cobrancas — cobranças dos animais do responsável.
route.get('/portal/cobrancas', requirePortal, async (req, res) => {
  try {
    const linhas = await sequelize.query(
      `SELECT c.id, c.descricao, c.status, c.total_cents, c.currency, c.createdAt,
              an.no_nome AS animal_nome
         FROM web_cobrancas c
         JOIN mob_animais an ON an.id = c.mob_animais_id
        WHERE an.mob_tutores_id = :tutorId
        ORDER BY c.createdAt DESC
        LIMIT 100`,
      { replacements: { tutorId: req.tutorId }, type: QueryTypes.SELECT }
    );
    return res.json({ success: true, itens: linhas });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao listar cobranças: ' + err.message });
  }
});

// GET /portal/cobrancas/:id/pagar — gera o link de checkout Stripe da cobrança.
route.get('/portal/cobrancas/:id/pagar', requirePortal, async (req, res) => {
  try {
    const cob = await WebCobrancas.findByPk(req.params.id);
    if (!cob) return res.status(404).json({ success: false, message: 'Cobrança não encontrada.' });
    // escopo: o animal da cobrança tem que ser do responsável logado.
    if (!cob.mob_animais_id || !(await petDoResponsavel(cob.mob_animais_id, req.tutorId))) {
      return res.status(404).json({ success: false, message: 'Cobrança não encontrada.' });
    }
    if (cob.status === 'paga') return res.status(400).json({ success: false, message: 'Cobrança já paga.' });
    const itens = await WebCobrancaItens.findAll({ where: { web_cobrancas_id: cob.id } });
    const vet = await WebVeterinarios.findByPk(cob.web_veterinarios_id);
    const r = await criarLinkCheckout({ ...cob.toJSON(), itens }, vet);
    if (!r.success) return res.status(400).json({ success: false, message: r.message });
    return res.json({ success: true, url: r.url });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao gerar pagamento: ' + err.message });
  }
});

// ---- Fase 2: agendamentos (ver + solicitar) ----

// GET /portal/agendamentos — próximos atendimentos dos pets do responsável.
route.get('/portal/agendamentos', requirePortal, async (req, res) => {
  try {
    const ags = await sequelize.query(
      `SELECT ag.id, ag.tp_agendamento, ag.dt_inicio, ag.ds_titulo, ag.ds_status,
              an.no_nome AS animal_nome
         FROM web_agendamentos ag
         JOIN mob_animais an ON an.id = ag.mob_animais_id
        WHERE an.mob_tutores_id = :tutorId
          AND ag.dt_inicio >= (NOW() - INTERVAL 1 DAY)
          AND (ag.ds_status IS NULL OR ag.ds_status NOT IN ('cancelado','faltou'))
        ORDER BY ag.dt_inicio ASC
        LIMIT 30`,
      { replacements: { tutorId: req.tutorId }, type: QueryTypes.SELECT }
    );
    const sols = await sequelize.query(
      `SELECT s.id, s.tp_agendamento, s.dt_sugerida, s.ds_motivo, s.ds_status, an.no_nome AS animal_nome
         FROM mol_agenda_solicitacao s
         JOIN mob_animais an ON an.id = s.mob_animais_id
        WHERE s.mob_tutores_id = :tutorId AND s.ds_status = 'pendente'
        ORDER BY s.createdAt DESC LIMIT 20`,
      { replacements: { tutorId: req.tutorId }, type: QueryTypes.SELECT }
    );
    return res.json({ success: true, agendamentos: ags, solicitacoes: sols });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao carregar agenda: ' + err.message });
  }
});

// POST /portal/solicitar-agendamento — o responsável pede um horário (vira pendente p/ o vet).
route.post('/portal/solicitar-agendamento', requirePortal, async (req, res) => {
  try {
    const { mob_animais_id, tp_agendamento, dt_sugerida, ds_motivo } = req.body || {};
    if (!mob_animais_id || !(await petDoResponsavel(mob_animais_id, req.tutorId))) {
      return res.status(400).json({ success: false, message: 'Selecione um pet válido.' });
    }
    // resolve o vet (web) do animal por CRMV.
    const v = await sequelize.query(
      `SELECT wv.id FROM mob_animais a
         JOIN mob_veterinarios mv ON mv.id = a.mob_veterinarios_id
         JOIN web_veterinarios wv ON wv.nu_crmv = mv.nu_crmv AND wv.ds_estado_crmv = mv.ds_estado_crmv
        WHERE a.id = :animalId LIMIT 1`,
      { replacements: { animalId: mob_animais_id }, type: QueryTypes.SELECT }
    );
    if (!v.length) return res.status(400).json({ success: false, message: 'Não encontramos o veterinário deste pet.' });
    await MolAgendaSolicitacao.create({
      mob_animais_id, web_veterinarios_id: v[0].id, mob_tutores_id: req.tutorId,
      tp_agendamento: tp_agendamento || 'consulta',
      dt_sugerida: dt_sugerida || null,
      ds_motivo: (ds_motivo || '').slice(0, 255) || null,
      ds_status: 'pendente',
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao solicitar agendamento: ' + err.message });
  }
});

module.exports = route;
