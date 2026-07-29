'use strict';
const express = require('express');
const route = express.Router();
const { QueryTypes } = require('sequelize');
const models = require('../../models');
const { WebPetPerfil, WebConsentimento, WebTutorPerfil, WebCampanhas, WebCampanhaEnvios, sequelize } = models;
const requireAuth = require('../../middleware/requireAuth');
const { gerarGatilhos, processarCampanhas, previewGatilho, gerarGatilho, previewCampanha, criarCampanhaCustom } = require('../../utils/retencao');

const TIPOS_GATILHO = ['inativo', 'aniversario', 'checkup_idoso', 'pos_atendimento'];

// Todas exigem sessão; identidade = req.vetId. Montado por ÚLTIMO no index.js.
route.use(requireAuth);

// GET /retencao/campanhas-salvas — campanhas CRIADAS pelo vet (as apagáveis).
// Registrada antes de /retencao/campanhas? Não há colisão: os caminhos são
// distintos e exatos. Traz a contagem de envios para a tela mostrar o impacto
// de apagar (só os pendentes somem; o que já foi enviado vira histórico).
route.get('/retencao/campanhas-salvas', async (req, res) => {
  try {
    const linhas = await sequelize.query(
      `SELECT c.id, c.ds_nome, c.ds_descricao, c.ds_mensagem, c.ds_filtros, c.createdAt,
              (SELECT COUNT(*) FROM web_campanha_envios e WHERE e.web_campanhas_id = c.id) AS qt_envios,
              (SELECT COUNT(*) FROM web_campanha_envios e WHERE e.web_campanhas_id = c.id AND e.st_status = 'pendente') AS qt_pendentes,
              (SELECT COUNT(*) FROM web_campanha_envios e WHERE e.web_campanhas_id = c.id AND e.st_status = 'enviado') AS qt_enviados
         FROM web_campanhas c
        WHERE c.web_veterinarios_id = :vetId
        ORDER BY c.createdAt DESC, c.id DESC
        LIMIT 100`,
      { replacements: { vetId: req.vetId }, type: QueryTypes.SELECT }
    );
    return res.json({ success: true, itens: linhas });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao listar campanhas salvas: ' + err.message });
  }
});

// DELETE /retencao/campanhas-salvas/:id — apaga uma campanha do vet.
// Os envios ainda PENDENTES são removidos (é o que impede o disparo); os já
// enviados/com erro são preservados como histórico, só perdem o vínculo.
route.delete('/retencao/campanhas-salvas/:id', async (req, res) => {
  try {
    const camp = await WebCampanhas.findOne({
      where: { id: req.params.id, web_veterinarios_id: req.vetId },
    });
    if (!camp) return res.status(404).json({ success: false, message: 'Campanha não encontrada.' });

    const removidos = await WebCampanhaEnvios.destroy({
      where: { web_campanhas_id: camp.id, st_status: 'pendente' },
    });
    await WebCampanhaEnvios.update(
      { web_campanhas_id: null },
      { where: { web_campanhas_id: camp.id } }
    );
    await camp.destroy();

    return res.json({ success: true, pendentesRemovidos: removidos });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao apagar campanha: ' + err.message });
  }
});

// GET /retencao/campanhas?de=&ate= — fila de envios de retenção deste vet.
// O período é OPCIONAL (sem ele, devolve tudo — comportamento antigo) e filtra
// por `dt_agendado_para`, não por `dt_enviado`: o pendente ainda não tem data de
// envio e sumiria do recorte justamente quando é ele que precisa de atenção.
// O filtro é feito aqui, e não na tela, porque o LIMIT 200 e os KPIs saem desta
// mesma consulta — filtrar depois daria contagem e lista truncadas.
route.get('/retencao/campanhas', async (req, res) => {
  try {
    const { de, ate } = req.query;
    const temPeriodo = Boolean(de && ate);
    const filtroPeriodo = temPeriodo ? 'AND ce.dt_agendado_para BETWEEN :de AND :ate' : '';

    const linhas = await sequelize.query(
      `SELECT ce.id, ce.tp_gatilho, ce.canal, ce.ds_titulo, ce.ds_descricao, ce.dt_agendado_para,
              ce.dt_enviado, ce.st_status, ce.ds_erro, an.no_nome AS animal_nome,
              t.no_completo AS responsavel_nome
         FROM web_campanha_envios ce
         JOIN mob_animais an ON an.id = ce.mob_animais_id
         LEFT JOIN mob_tutores t ON t.id = ce.mob_tutores_id
        WHERE ce.web_veterinarios_id = :vetId
          ${filtroPeriodo}
        ORDER BY ce.createdAt DESC, ce.id DESC
        LIMIT 200`,
      {
        replacements: {
          vetId: req.vetId,
          ...(temPeriodo ? { de: new Date(de), ate: new Date(ate) } : {})
        },
        type: QueryTypes.SELECT
      }
    );
    // KPIs simples por status
    const kpis = linhas.reduce((a, l) => { a[l.st_status] = (a[l.st_status] || 0) + 1; return a; }, {});
    return res.json({ success: true, itens: linhas, kpis });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao listar campanhas: ' + err.message });
  }
});

// POST /retencao/gerar — varre os gatilhos e cria os envios pendentes (dedup).
route.post('/retencao/gerar', async (req, res) => {
  try {
    const r = await gerarGatilhos({ vetId: req.vetId });
    return res.json({ success: true, ...r });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao gerar gatilhos: ' + err.message });
  }
});

// GET /retencao/preview?tp=... — prévia do público de um gatilho (total + amostra
// + mensagem padrão sugerida) para o construtor de campanhas.
route.get('/retencao/preview', async (req, res) => {
  try {
    const tp = String(req.query.tp || '');
    if (!TIPOS_GATILHO.includes(tp)) {
      return res.status(400).json({ success: false, message: 'Tipo de gatilho inválido. Use: ' + TIPOS_GATILHO.join(', ') });
    }
    const r = await previewGatilho({ vetId: req.vetId, tp });
    return res.json({ success: true, ...r });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro na prévia: ' + err.message });
  }
});

// POST /retencao/gatilho — cria a campanha de UM gatilho com a mensagem informada.
route.post('/retencao/gatilho', async (req, res) => {
  try {
    const { tp_gatilho, mensagem } = req.body || {};
    if (!TIPOS_GATILHO.includes(tp_gatilho)) {
      return res.status(400).json({ success: false, message: 'Tipo de gatilho inválido.' });
    }
    const r = await gerarGatilho({ vetId: req.vetId, tp: tp_gatilho, mensagem });
    return res.json({ success: true, ...r });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao criar gatilho: ' + err.message });
  }
});

// POST /retencao/campanha/preview — prévia do público de uma campanha parametrizável.
route.post('/retencao/campanha/preview', async (req, res) => {
  try {
    const r = await previewCampanha({ vetId: req.vetId, filtros: (req.body && req.body.filtros) || {} });
    return res.json({ success: true, ...r });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro na prévia da campanha: ' + err.message });
  }
});

// POST /retencao/campanha — cria a campanha parametrizável (filtros + mensagem).
route.post('/retencao/campanha', async (req, res) => {
  try {
    const { filtros, mensagem, nome, descricao } = req.body || {};
    const r = await criarCampanhaCustom({ vetId: req.vetId, filtros: filtros || {}, mensagem, nome, descricao });
    return res.json({ success: true, ...r });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao criar campanha: ' + err.message });
  }
});

// POST /retencao/disparar — envia os pendentes vencidos deste vet (disparo manual).
route.post('/retencao/disparar', async (req, res) => {
  try {
    const r = await processarCampanhas({ vetId: req.vetId, limite: req.body && req.body.limite });
    return res.json({ success: true, ...r });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao disparar campanhas: ' + err.message });
  }
});

// GET /retencao/pet-perfil/:animalId — perfil (Fase B) de um animal.
route.get('/retencao/pet-perfil/:animalId', async (req, res) => {
  try {
    const p = await WebPetPerfil.findOne({ where: { mob_animais_id: req.params.animalId } });
    return res.json({ success: true, perfil: p || null });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao ler perfil: ' + err.message });
  }
});

// PUT /retencao/pet-perfil/:animalId — cria/atualiza o perfil do pet.
route.put('/retencao/pet-perfil/:animalId', async (req, res) => {
  try {
    const mob_animais_id = Number(req.params.animalId);
    const { dt_nascimento, ds_raca, ds_doencas_cronicas, ds_porte, st_castrado } = req.body;
    const existente = await WebPetPerfil.findOne({ where: { mob_animais_id } });
    const dados = {
      mob_animais_id,
      dt_nascimento: dt_nascimento || null,
      ds_raca: ds_raca || null,
      ds_doencas_cronicas: ds_doencas_cronicas || null,
      ds_porte: ds_porte || null,
      st_castrado: st_castrado != null ? Number(st_castrado) : null,
    };
    if (existente) await existente.update(dados);
    else await WebPetPerfil.create(dados);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao salvar perfil: ' + err.message });
  }
});

// GET /retencao/consentimento/:tutorId — estado atual (ausência de linha = tudo permitido).
route.get('/retencao/consentimento/:tutorId', async (req, res) => {
  try {
    const c = await WebConsentimento.findOne({ where: { mob_tutores_id: req.params.tutorId } });
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

// PUT /retencao/consentimento/:tutorId — opt-in/out de comunicação (LGPD).
route.put('/retencao/consentimento/:tutorId', async (req, res) => {
  try {
    const mob_tutores_id = Number(req.params.tutorId);
    const { st_email, st_whatsapp, st_marketing } = req.body;
    const existente = await WebConsentimento.findOne({ where: { mob_tutores_id } });
    const dados = {
      mob_tutores_id,
      st_email: st_email != null ? Number(st_email) : 1,
      st_whatsapp: st_whatsapp != null ? Number(st_whatsapp) : 1,
      st_marketing: st_marketing != null ? Number(st_marketing) : 1,
    };
    if (existente) await existente.update(dados);
    else await WebConsentimento.create(dados);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao salvar consentimento: ' + err.message });
  }
});

// ---- Endereço do RESPONSÁVEL (satélite web_tutor_perfil) ----
// Conteúdo mínimo dos atestados (Resolução CFMV 1.321/2020). Vive aqui, junto do
// consentimento, porque é o outro dado do responsável editado pelo PetPerfilCard.
// Satélite porque mob_tutores não pode ser alterada (só web_*).

// GET /retencao/tutor-perfil/:tutorId — endereço atual (null quando nunca preenchido).
route.get('/retencao/tutor-perfil/:tutorId', async (req, res) => {
  try {
    const perfil = await WebTutorPerfil.findOne({ where: { mob_tutores_id: req.params.tutorId } });
    return res.json({ success: true, perfil: perfil || null });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao ler endereço do responsável: ' + err.message });
  }
});

// PUT /retencao/tutor-perfil/:tutorId — cria/atualiza (find-or-create pelo unique).
route.put('/retencao/tutor-perfil/:tutorId', async (req, res) => {
  try {
    const mob_tutores_id = Number(req.params.tutorId);
    const { ds_logradouro, nu_numero, ds_complemento, ds_bairro, ds_cidade, ds_uf, nu_cep } = req.body;
    const dados = {
      mob_tutores_id,
      ds_logradouro: ds_logradouro || null,
      nu_numero: nu_numero || null,
      ds_complemento: ds_complemento || null,
      ds_bairro: ds_bairro || null,
      ds_cidade: ds_cidade || null,
      ds_uf: ds_uf ? String(ds_uf).toUpperCase().slice(0, 2) : null,
      nu_cep: nu_cep || null,
    };
    const existente = await WebTutorPerfil.findOne({ where: { mob_tutores_id } });
    if (existente) await existente.update(dados);
    else await WebTutorPerfil.create(dados);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao salvar endereço do responsável: ' + err.message });
  }
});

module.exports = route;
