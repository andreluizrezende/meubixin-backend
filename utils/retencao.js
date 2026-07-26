'use strict';
/*
 * Motor de RETENÇÃO INTELIGENTE (Fases A e B).
 * - gerarGatilhos({vetId}): varre os dados (só web_* alteráveis + leitura de mob_*)
 *   e insere linhas em web_campanha_envios (pendente), com DEDUP (unique index) e
 *   respeitando CONSENTIMENTO (web_consentimento). Gatilhos:
 *     vacina_vencendo (transacional), pos_atendimento (transacional),
 *     inativo, aniversario, checkup_idoso (marketing → respeitam st_marketing).
 * - processarCampanhas({vetId, limite}): envia os pendentes vencidos (e-mail/WhatsApp).
 */
const { QueryTypes } = require('sequelize');
const models = require('../models');
const { WebCampanhaEnvios, WebConsentimento, sequelize } = models;
const { enviarEmail, enviarWhatsApp } = require('./notificacoes');

const MARKETING = new Set(['inativo', 'aniversario', 'checkup_idoso', 'campanha']);
const IDADE_IDOSO = 7;

const ym = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
const semestre = (d) => `${d.getFullYear()}${d.getMonth() < 6 ? 'H1' : 'H2'}`;

// SQL: animais do vet (por CRMV) + contato do responsável + perfil + última consulta.
const BASE_SQL = `
  SELECT ani.id AS mob_animais_id, ani.no_nome AS animal_nome, ani.vl_idade,
         ani.ds_especie AS especie,
         t.id AS mob_tutores_id, t.no_completo AS responsavel_nome,
         t.ds_email AS email, t.nu_telefone_completo AS telefone,
         pp.dt_nascimento, pp.ds_raca, pp.ds_porte, pp.st_castrado, pp.ds_doencas_cronicas,
         (SELECT MAX(x.dt_data_anamnese) FROM web_anamneses x
           WHERE x.mob_animais_id = ani.id AND x.web_veterinarios_id = :vetId) AS ultima_consulta
    FROM mob_animais ani
    JOIN mob_veterinarios v ON v.id = ani.mob_veterinarios_id
    JOIN web_veterinarios wv ON wv.id = :vetId
    LEFT JOIN mob_tutores t ON t.id = ani.mob_tutores_id
    LEFT JOIN web_pet_perfil pp ON pp.mob_animais_id = ani.id
   WHERE v.nu_crmv = wv.nu_crmv AND v.ds_estado_crmv = wv.ds_estado_crmv`;

// NOTA: os lembretes de DOSE (vacina/vermífugo/medicamento) NÃO ficam mais aqui —
// migraram para o motor de lembretes (utils/processarLembretes.js → gerarLembretesDose),
// exibidos na tela de Lembretes. Retenção cobre só inativo/aniversário/check-up/pós.

const POS_SQL = `
  SELECT a.id AS agendamento_id, ani.id AS mob_animais_id, ani.no_nome AS animal_nome,
         t.id AS mob_tutores_id, t.no_completo AS responsavel_nome, t.ds_email AS email, t.nu_telefone_completo AS telefone
    FROM web_agendamentos a
    JOIN mob_animais ani ON ani.id = a.mob_animais_id
    LEFT JOIN mob_tutores t ON t.id = ani.mob_tutores_id
   WHERE a.web_veterinarios_id = :vetId AND a.ds_status = 'concluido'
     AND a.dt_inicio BETWEEN DATE_SUB(NOW(), INTERVAL 8 DAY) AND DATE_SUB(NOW(), INTERVAL 7 DAY)`;

async function gerarGatilhos({ vetId }) {
  if (!vetId) throw new Error('vetId é obrigatório');
  const agora = new Date();
  const base = await sequelize.query(BASE_SQL, { replacements: { vetId }, type: QueryTypes.SELECT });
  const pos = await sequelize.query(POS_SQL, { replacements: { vetId }, type: QueryTypes.SELECT });

  // consentimento por tutor
  const tutorIds = [...new Set([...base, ...pos].map((r) => r.mob_tutores_id).filter(Boolean))];
  const consMap = {};
  if (tutorIds.length) {
    const cons = await WebConsentimento.findAll({ where: { mob_tutores_id: tutorIds } });
    cons.forEach((c) => { consMap[c.mob_tutores_id] = c; });
  }

  const candidatos = [];
  for (const b of base) {
    const ultima = b.ultima_consulta ? new Date(b.ultima_consulta) : null;
    const dias = ultima ? (agora - ultima) / 86400000 : Infinity;
    if (dias >= 90) candidatos.push({ ...b, tp_gatilho: 'inativo', ds_titulo: null, ref: `inativo:${b.mob_animais_id}:${ym(agora)}` });
    if (b.dt_nascimento) {
      const d = new Date(b.dt_nascimento);
      if (d.getUTCMonth() === agora.getMonth() && d.getUTCDate() === agora.getDate()) {
        candidatos.push({ ...b, tp_gatilho: 'aniversario', ds_titulo: null, ref: `aniversario:${b.mob_animais_id}:${agora.getFullYear()}` });
      }
    }
    const idade = b.dt_nascimento ? Math.floor((agora - new Date(b.dt_nascimento)) / (365.25 * 86400000)) : (Number(b.vl_idade) || 0);
    if (idade >= IDADE_IDOSO && dias >= 180) {
      candidatos.push({ ...b, tp_gatilho: 'checkup_idoso', ds_titulo: null, ref: `checkup:${b.mob_animais_id}:${semestre(agora)}` });
    }
  }
  for (const p of pos) candidatos.push({ ...p, tp_gatilho: 'pos_atendimento', ds_titulo: null, ref: `posatend:${p.agendamento_id}` });

  const linhas = [];
  for (const c of candidatos) {
    const cons = consMap[c.mob_tutores_id];
    if (MARKETING.has(c.tp_gatilho) && cons && cons.st_marketing === 0) continue;
    const canais = [];
    if (c.email && (!cons || cons.st_email !== 0)) canais.push('email');
    if (c.telefone && (!cons || cons.st_whatsapp !== 0)) canais.push('whatsapp');
    for (const canal of canais) {
      linhas.push({
        web_veterinarios_id: vetId,
        mob_animais_id: c.mob_animais_id,
        mob_tutores_id: c.mob_tutores_id || null,
        tp_gatilho: c.tp_gatilho,
        canal,
        ds_titulo: c.ds_titulo || null,
        dt_agendado_para: agora,
        st_status: 'pendente',
        ds_chave_dedup: `${c.ref}:${canal}`,
      });
    }
  }
  let criados = 0;
  if (linhas.length) {
    const antes = await WebCampanhaEnvios.count({ where: { web_veterinarios_id: vetId } });
    await WebCampanhaEnvios.bulkCreate(linhas, { ignoreDuplicates: true });
    const depois = await WebCampanhaEnvios.count({ where: { web_veterinarios_id: vetId } });
    criados = depois - antes;
  }
  return { candidatos: candidatos.length, gerados: criados };
}

// ---- Construtor de campanhas (tela "Criar gatilho") ----

// Seleciona o público de UM tipo de gatilho (sem consentimento ainda).
async function candidatosPorTipo({ vetId, tp }) {
  if (!vetId) throw new Error('vetId é obrigatório');
  const agora = new Date();
  if (tp === 'pos_atendimento') {
    const pos = await sequelize.query(POS_SQL, { replacements: { vetId }, type: QueryTypes.SELECT });
    return pos.map((p) => ({ ...p, ref: `posatend:${p.agendamento_id}` }));
  }
  const base = await sequelize.query(BASE_SQL, { replacements: { vetId }, type: QueryTypes.SELECT });
  const amanha = new Date(agora.getTime() + 86400000);
  const out = [];
  for (const b of base) {
    const ultima = b.ultima_consulta ? new Date(b.ultima_consulta) : null;
    const dias = ultima ? (agora - ultima) / 86400000 : Infinity;
    if (tp === 'inativo') {
      if (dias >= 90) out.push({ ...b, ref: `inativo:${b.mob_animais_id}:${ym(agora)}` });
    } else if (tp === 'aniversario') {
      if (b.dt_nascimento) {
        const d = new Date(b.dt_nascimento);
        const hoje = d.getUTCMonth() === agora.getMonth() && d.getUTCDate() === agora.getDate();
        const proximo = d.getUTCMonth() === amanha.getMonth() && d.getUTCDate() === amanha.getDate();
        if (hoje || proximo) out.push({ ...b, ref: `aniversario:${b.mob_animais_id}:${agora.getFullYear()}` });
      }
    } else if (tp === 'checkup_idoso') {
      const idade = b.dt_nascimento ? Math.floor((agora - new Date(b.dt_nascimento)) / (365.25 * 86400000)) : (Number(b.vl_idade) || 0);
      if (idade >= IDADE_IDOSO && dias >= 180) out.push({ ...b, ref: `checkup:${b.mob_animais_id}:${semestre(agora)}` });
    }
  }
  return out;
}

async function mapaConsentimento(cands) {
  const tutorIds = [...new Set(cands.map((c) => c.mob_tutores_id).filter(Boolean))];
  const consMap = {};
  if (tutorIds.length) {
    const cons = await WebConsentimento.findAll({ where: { mob_tutores_id: tutorIds } });
    cons.forEach((c) => { consMap[c.mob_tutores_id] = c; });
  }
  return consMap;
}

// Canais permitidos para o candidato (respeita consentimento).
function canaisPermitidos(c, tp, consMap) {
  const cons = consMap[c.mob_tutores_id];
  if (MARKETING.has(tp) && cons && cons.st_marketing === 0) return [];
  const canais = [];
  if (c.email && (!cons || cons.st_email !== 0)) canais.push('email');
  if (c.telefone && (!cons || cons.st_whatsapp !== 0)) canais.push('whatsapp');
  return canais;
}

// Mensagem padrão (editável na tela) por tipo. Placeholders: {animal}, {responsavel}.
function mensagemPadrao(tp) {
  switch (tp) {
    case 'inativo': return 'Olá, {responsavel}! Faz um tempo que não vemos o {animal} por aqui. Que tal agendar um check-up para garantir que está tudo bem? 💚';
    case 'aniversario': return 'Olá, {responsavel}! Amanhã é aniversário do {animal}! 🎂 Desejamos muita saúde e alegria. Conte com a gente para cuidar dele. 🐾';
    case 'checkup_idoso': return 'Olá, {responsavel}! O {animal} já está na fase sênior — recomendamos um check-up semestral para detectar cedo qualquer alteração. Vamos agendar? 🩺';
    case 'pos_atendimento': return 'Olá, {responsavel}! Como o {animal} está após o atendimento? Sua opinião é muito importante — conte pra gente como foi sua experiência. 🙏';
    default: return 'Olá, {responsavel}! Temos novidades sobre o {animal}.';
  }
}

// Prévia: quantas pessoas seriam contatadas + amostra + mensagem padrão sugerida.
async function previewGatilho({ vetId, tp }) {
  const cands = await candidatosPorTipo({ vetId, tp });
  const consMap = await mapaConsentimento(cands);
  const elegiveis = cands.filter((c) => canaisPermitidos(c, tp, consMap).length > 0);
  return {
    total: elegiveis.length,
    amostra: elegiveis.slice(0, 10).map((c) => ({ animal_nome: c.animal_nome, responsavel_nome: c.responsavel_nome })),
    mensagemPadrao: mensagemPadrao(tp),
  };
}

// Cria a campanha de UM gatilho com a mensagem informada (renderizada por destinatário).
async function gerarGatilho({ vetId, tp, mensagem }) {
  const cands = await candidatosPorTipo({ vetId, tp });
  const consMap = await mapaConsentimento(cands);
  const render = (txt, c) => String(txt || '')
    .replace(/\{animal\}/gi, c.animal_nome || 'seu pet')
    .replace(/\{respons[aá]vel\}|\{tutor\}/gi, c.responsavel_nome || 'responsável');
  const agora = new Date();
  const linhas = [];
  for (const c of cands) {
    const canais = canaisPermitidos(c, tp, consMap);
    const msg = mensagem && mensagem.trim() ? render(mensagem, c) : null;
    for (const canal of canais) {
      linhas.push({
        web_veterinarios_id: vetId, mob_animais_id: c.mob_animais_id, mob_tutores_id: c.mob_tutores_id || null,
        tp_gatilho: tp, canal, ds_titulo: null, ds_mensagem: msg,
        dt_agendado_para: agora, st_status: 'pendente', ds_chave_dedup: `${c.ref}:${canal}`,
      });
    }
  }
  let gerados = 0;
  if (linhas.length) {
    const antes = await WebCampanhaEnvios.count({ where: { web_veterinarios_id: vetId } });
    await WebCampanhaEnvios.bulkCreate(linhas, { ignoreDuplicates: true });
    gerados = (await WebCampanhaEnvios.count({ where: { web_veterinarios_id: vetId } })) - antes;
  }
  return { candidatos: cands.length, gerados };
}

// ---- Campanha PARAMETRIZÁVEL (filtros sobre os dados do sistema) ----
// filtros: { especie, raca, porte, castrado('1'|'0'), idadeMin, idadeMax,
//            diasSemConsulta, comDoencaCronica('sim'|'nao') } — todos opcionais.
async function filtrarPublico({ vetId, filtros = {} }) {
  if (!vetId) throw new Error('vetId é obrigatório');
  const base = await sequelize.query(BASE_SQL, { replacements: { vetId }, type: QueryTypes.SELECT });
  const agora = Date.now();
  const f = filtros || {};
  const norm = (s) => String(s || '').trim().toLowerCase();
  return base.filter((b) => {
    if (f.especie && norm(b.especie) !== norm(f.especie)) return false;
    if (f.raca && !norm(b.ds_raca).includes(norm(f.raca))) return false;
    if (f.porte && norm(b.ds_porte) !== norm(f.porte)) return false;
    if (f.castrado === '1' && Number(b.st_castrado) !== 1) return false;
    if (f.castrado === '0' && Number(b.st_castrado) === 1) return false;
    const idade = b.dt_nascimento ? Math.floor((agora - new Date(b.dt_nascimento)) / (365.25 * 86400000)) : (b.vl_idade != null ? Number(b.vl_idade) : null);
    if (f.idadeMin != null && f.idadeMin !== '' && (idade == null || idade < Number(f.idadeMin))) return false;
    if (f.idadeMax != null && f.idadeMax !== '' && (idade == null || idade > Number(f.idadeMax))) return false;
    if (f.diasSemConsulta != null && f.diasSemConsulta !== '') {
      const ultima = b.ultima_consulta ? new Date(b.ultima_consulta) : null;
      const dias = ultima ? (agora - ultima) / 86400000 : Infinity;
      if (dias < Number(f.diasSemConsulta)) return false;
    }
    const temDoenca = !!(b.ds_doencas_cronicas && String(b.ds_doencas_cronicas).trim());
    if (f.comDoencaCronica === 'sim' && !temDoenca) return false;
    if (f.comDoencaCronica === 'nao' && temDoenca) return false;
    return true;
  });
}

async function previewCampanha({ vetId, filtros }) {
  const cands = await filtrarPublico({ vetId, filtros });
  const consMap = await mapaConsentimento(cands);
  const elegiveis = cands.filter((c) => canaisPermitidos(c, 'campanha', consMap).length > 0);
  return {
    total: elegiveis.length,
    amostra: elegiveis.slice(0, 10).map((c) => ({ animal_nome: c.animal_nome, responsavel_nome: c.responsavel_nome })),
  };
}

async function criarCampanhaCustom({ vetId, filtros, mensagem }) {
  const cands = await filtrarPublico({ vetId, filtros });
  const consMap = await mapaConsentimento(cands);
  const render = (txt, c) => String(txt || '')
    .replace(/\{animal\}/gi, c.animal_nome || 'seu pet')
    .replace(/\{respons[aá]vel\}|\{tutor\}/gi, c.responsavel_nome || 'responsável');
  const nonce = Date.now(); // cada criação é uma campanha nova (blast único)
  const agora = new Date();
  const linhas = [];
  for (const c of cands) {
    const canais = canaisPermitidos(c, 'campanha', consMap);
    const msg = mensagem && mensagem.trim() ? render(mensagem, c) : null;
    for (const canal of canais) {
      linhas.push({
        web_veterinarios_id: vetId, mob_animais_id: c.mob_animais_id, mob_tutores_id: c.mob_tutores_id || null,
        tp_gatilho: 'campanha', canal, ds_titulo: null, ds_mensagem: msg,
        dt_agendado_para: agora, st_status: 'pendente', ds_chave_dedup: `campanha:${nonce}:${c.mob_animais_id}:${canal}`,
      });
    }
  }
  let gerados = 0;
  if (linhas.length) {
    const antes = await WebCampanhaEnvios.count({ where: { web_veterinarios_id: vetId } });
    await WebCampanhaEnvios.bulkCreate(linhas, { ignoreDuplicates: true });
    gerados = (await WebCampanhaEnvios.count({ where: { web_veterinarios_id: vetId } })) - antes;
  }
  return { candidatos: cands.length, gerados };
}

// ---- mensagens por gatilho ----
function wrapEmail(titulo, corpo) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f4;margin:0;padding:0">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.1)">
  <div style="background:linear-gradient(135deg,#8BC34A,#6a9e2f);color:#fff;padding:26px 20px;text-align:center"><h1 style="margin:0;font-size:22px">${titulo}</h1><p style="margin:4px 0 0;opacity:.9;font-size:13px">Meu Bixin</p></div>
  <div style="padding:26px 20px;color:#555;line-height:1.7;font-size:15px">${corpo}
    <p style="color:#888;font-size:13px;margin-top:22px">Dúvidas? <a href="mailto:suporte@cicatribio.com.br" style="color:#8BC34A">suporte@cicatribio.com.br</a></p>
  </div>
  <div style="background:#2c3e50;color:#ecf0f1;padding:16px;text-align:center;font-size:12px">Meu Bixin — Sistema de Gestão Veterinária</div>
</div></body></html>`;
}

function montarMensagem(row) {
  const nome = row.responsavel_nome || 'responsável';
  const animal = row.animal_nome;
  const vet = row.vet_nome || 'sua clínica';
  let assunto, corpoHtml, textoWhats;
  switch (row.tp_gatilho) {
    case 'inativo':
      assunto = `Sentimos falta do ${animal}!`;
      corpoHtml = `<p>Olá, <strong>${nome}</strong>!</p><p>Faz um tempinho que não vemos o <strong>${animal}</strong> por aqui. Que tal um check-up para garantir que está tudo bem?</p>`;
      textoWhats = `🐾 *${vet}*\n\nOlá, *${nome}*! Faz um tempo que não vemos o *${animal}*. Que tal agendar um check-up? Vamos adorar cuidar dele. 💚`;
      break;
    case 'aniversario':
      assunto = `Feliz aniversário, ${animal}! 🎉`;
      corpoHtml = `<p>Olá, <strong>${nome}</strong>!</p><p>Hoje é um dia especial: <strong>${animal}</strong> está de aniversário! 🎂 Desejamos muita saúde e alegria. Conte com a gente para cuidar dele.</p>`;
      textoWhats = `🎂 *${vet}*\n\nOlá, *${nome}*! Hoje é aniversário do *${animal}*! 🎉 Muita saúde e alegria para ele. Conte com a gente. 🐾`;
      break;
    case 'checkup_idoso':
      assunto = `${animal} merece um check-up sênior`;
      corpoHtml = `<p>Olá, <strong>${nome}</strong>!</p><p>O <strong>${animal}</strong> já está na fase sênior. Nessa idade, recomendamos um <strong>check-up semestral</strong> para detectar cedo qualquer alteração. Vamos agendar?</p>`;
      textoWhats = `🐾 *${vet}*\n\nOlá, *${nome}*! O *${animal}* já é sênior — recomendamos um check-up semestral para cuidar da saúde dele. Vamos agendar? 🩺`;
      break;
    case 'pos_atendimento':
      assunto = `Como está o ${animal}?`;
      corpoHtml = `<p>Olá, <strong>${nome}</strong>!</p><p>Passando para saber como o <strong>${animal}</strong> está após o atendimento. Sua opinião é muito importante — responda esta mensagem contando como foi sua experiência. 🙏</p>`;
      textoWhats = `🐾 *${vet}*\n\nOlá, *${nome}*! Como o *${animal}* está após o atendimento? Sua opinião é muito importante — conta pra gente como foi sua experiência? 🙏`;
      break;
    default:
      assunto = `Mensagem sobre ${animal}`;
      corpoHtml = `<p>Olá, <strong>${nome}</strong>!</p>`;
      textoWhats = `Olá, ${nome}!`;
  }
  const textoEmail = corpoHtml.replace(/<[^>]+>/g, '').trim();
  return { assunto, html: wrapEmail(assunto, corpoHtml), textoEmail, textoWhats: `${textoWhats}\n\n---\n_Meu Bixin_` };
}

async function processarCampanhas({ vetId, limite = 50 } = {}) {
  const lim = Math.min(Number(limite) || 50, 200);
  const filtroVet = vetId ? 'AND ce.web_veterinarios_id = :vetId' : '';
  const pend = await sequelize.query(
    `SELECT ce.id AS envio_id, ce.tp_gatilho, ce.canal, ce.ds_titulo, ce.ds_mensagem, ce.mob_animais_id,
            ani.no_nome AS animal_nome, t.no_completo AS responsavel_nome,
            t.ds_email AS email, t.nu_telefone_completo AS telefone, wv.no_completo AS vet_nome
       FROM web_campanha_envios ce
       JOIN mob_animais ani ON ani.id = ce.mob_animais_id
       LEFT JOIN mob_tutores t ON t.id = ce.mob_tutores_id
       LEFT JOIN web_veterinarios wv ON wv.id = ce.web_veterinarios_id
      WHERE ce.st_status = 'pendente' AND ce.dt_agendado_para <= NOW() ${filtroVet}
      ORDER BY ce.dt_agendado_para ASC LIMIT :lim`,
    { replacements: { lim, vetId }, type: QueryTypes.SELECT }
  );

  let enviados = 0, erros = 0, pulados = 0;
  for (const row of pend) {
    const [claimed] = await WebCampanhaEnvios.update(
      { st_status: 'enviando' },
      { where: { id: row.envio_id, st_status: 'pendente' } }
    );
    if (!claimed) { pulados++; continue; }
    // mensagem personalizada (construtor de campanhas) tem prioridade
    let msg;
    if (row.ds_mensagem && row.ds_mensagem.trim()) {
      const assunto = `Mensagem de ${row.vet_nome || 'sua clínica'}`;
      msg = {
        assunto,
        html: wrapEmail(assunto, `<p>${row.ds_mensagem.replace(/\n/g, '<br>')}</p>`),
        textoEmail: row.ds_mensagem,
        textoWhats: `${row.ds_mensagem}\n\n---\n_Meu Bixin_`,
      };
    } else {
      msg = montarMensagem(row);
    }
    let ok = false;
    if (row.canal === 'email') ok = await enviarEmail({ para: row.email, assunto: msg.assunto, html: msg.html, texto: msg.textoEmail });
    else if (row.canal === 'whatsapp') ok = await enviarWhatsApp({ telefone: row.telefone, texto: msg.textoWhats });
    if (ok) { await WebCampanhaEnvios.update({ st_status: 'enviado', dt_enviado: new Date() }, { where: { id: row.envio_id } }); enviados++; }
    else { await WebCampanhaEnvios.update({ st_status: 'erro', ds_erro: `Falha no envio (${row.canal})` }, { where: { id: row.envio_id } }); erros++; }
  }
  return { processados: pend.length, enviados, erros, pulados };
}

module.exports = { gerarGatilhos, processarCampanhas, montarMensagem, previewGatilho, gerarGatilho, mensagemPadrao, previewCampanha, criarCampanhaCustom };
