'use strict';
// Núcleo do motor de lembretes (Fase 2). Suporta duas origens em web_lembretes:
//  - 'agendamento' (ligado a web_agendamentos): consultas/retornos/etc.
//  - 'dose' (web_protocolos_agendas): vacina/vermífugo (vencendo) e medicamento (diário).
const { QueryTypes } = require('sequelize');
const models = require('../models');
const { WebLembretes, sequelize } = models;
const { enviarEmail, enviarWhatsApp } = require('./notificacoes');

const TIPO_LABEL = {
  consulta: 'Consulta', retorno: 'Retorno', vacina: 'Vacina',
  procedimento: 'Procedimento', teleconsulta: 'Teleconsulta',
};

// ---------- Geração de lembretes de DOSE ----------
// vacina/vermífugo → por dose vencendo (≤15d à frente / ≤30d vencida).
// medicamento → 1 por medicamento por DIA (doses de hoje) — "a cada 24h".
async function gerarLembretesDose({ vetId }) {
  if (!vetId) throw new Error('vetId é obrigatório');
  const agora = new Date();
  const ymd = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

  const periodicas = await sequelize.query(
    `SELECT ag.id AS agenda_id, p.st_tipo_protocolo AS tipo, ag.dt_data_aplicacao AS dt_dose,
            COALESCE(p.nome_protocolo, ps.ds_protocolos_saude) AS nome_protocolo,
            ani.id AS mob_animais_id, t.ds_email AS email, t.nu_telefone_completo AS telefone
       FROM web_protocolos_agendas ag
       JOIN web_protocolos p ON p.id = ag.web_protocolos_id
       LEFT JOIN web_protocolos_saude ps ON ps.id = p.web_protocolos_saude_id
       JOIN web_anamneses an ON an.id = p.web_anamneses_id
       JOIN mob_animais ani ON ani.id = an.mob_animais_id
       LEFT JOIN mob_tutores t ON t.id = ani.mob_tutores_id
      WHERE an.web_veterinarios_id = :vetId AND p.st_tipo_protocolo IN (0, 2) AND ag.st_concluido = 0
        AND ag.dt_data_aplicacao BETWEEN DATE_SUB(NOW(), INTERVAL 30 DAY) AND DATE_ADD(NOW(), INTERVAL 15 DAY)`,
    { replacements: { vetId }, type: QueryTypes.SELECT }
  );

  const medicamentos = await sequelize.query(
    `SELECT p.id AS protocolo_id, COALESCE(p.nome_protocolo, ps.ds_protocolos_saude) AS nome_protocolo,
            MIN(ag.dt_data_aplicacao) AS dt_dose,
            ani.id AS mob_animais_id, t.ds_email AS email, t.nu_telefone_completo AS telefone
       FROM web_protocolos_agendas ag
       JOIN web_protocolos p ON p.id = ag.web_protocolos_id
       LEFT JOIN web_protocolos_saude ps ON ps.id = p.web_protocolos_saude_id
       JOIN web_anamneses an ON an.id = p.web_anamneses_id
       JOIN mob_animais ani ON ani.id = an.mob_animais_id
       LEFT JOIN mob_tutores t ON t.id = ani.mob_tutores_id
      WHERE an.web_veterinarios_id = :vetId AND p.st_tipo_protocolo = 1 AND ag.st_concluido = 0
        AND DATE(ag.dt_data_aplicacao) = CURDATE()
      GROUP BY p.id, nome_protocolo, ani.id, t.ds_email, t.nu_telefone_completo`,
    { replacements: { vetId }, type: QueryTypes.SELECT }
  );

  const linhas = [];
  const addLinhas = (r, tpLembrete, ref) => {
    if (r.email) linhas.push(mkLinha(r, tpLembrete, `${ref}:email`, 'email', vetId, agora));
    if (r.telefone) linhas.push(mkLinha(r, tpLembrete, `${ref}:whatsapp`, 'whatsapp', vetId, agora));
  };
  for (const r of periodicas) {
    addLinhas(r, r.tipo === 0 ? 'dose_vacina' : 'dose_vermifugo', `dose:${r.agenda_id}`);
  }
  for (const r of medicamentos) {
    addLinhas(r, 'dose_medicamento', `medic:${r.protocolo_id}:${ymd(agora)}`);
  }

  let gerados = 0;
  if (linhas.length) {
    const antes = await WebLembretes.count({ where: { tp_origem: 'dose', web_veterinarios_id: vetId } });
    await WebLembretes.bulkCreate(linhas, { ignoreDuplicates: true });
    const depois = await WebLembretes.count({ where: { tp_origem: 'dose', web_veterinarios_id: vetId } });
    gerados = depois - antes;
  }
  return { candidatos: periodicas.length + medicamentos.length, gerados };
}

function mkLinha(r, tpLembrete, ref, canal, vetId, agora) {
  return {
    tp_origem: 'dose',
    web_agendamentos_id: null,
    web_veterinarios_id: vetId,
    mob_animais_id: r.mob_animais_id,
    ds_titulo: r.nome_protocolo || null,
    ds_ref: ref,
    tp_lembrete: tpLembrete,
    canal,
    // "Agendado p/" = data da dose (dt_data_aplicacao), não o momento da geração.
    dt_agendado_para: r.dt_dose ? new Date(r.dt_dose) : agora,
    st_status: 'pendente',
  };
}

// ---------- Mensagens ----------
function wrapEmail(titulo, corpoHtml) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f4;margin:0;padding:0">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.1)">
  <div style="background:linear-gradient(135deg,#8BC34A,#6a9e2f);color:#fff;padding:26px 20px;text-align:center"><h1 style="margin:0;font-size:22px">${titulo}</h1><p style="margin:4px 0 0;opacity:.9;font-size:13px">Meu Bixin</p></div>
  <div style="padding:26px 20px;color:#555;line-height:1.7;font-size:15px">${corpoHtml}
    <p style="color:#888;font-size:13px;margin-top:22px">Dúvidas? <a href="mailto:suporte@cicatribio.com.br" style="color:#8BC34A">suporte@cicatribio.com.br</a></p>
  </div>
  <div style="background:#2c3e50;color:#ecf0f1;padding:16px;text-align:center;font-size:12px">Meu Bixin — Sistema de Gestão Veterinária</div>
</div></body></html>`;
}

function montarMensagemDose(row) {
  const nome = row.responsavel_nome || 'responsável';
  const animal = row.animal_nome;
  const item = row.ds_titulo ? ` ${row.ds_titulo}` : '';
  const itemW = row.ds_titulo ? ` *${row.ds_titulo}*` : '';
  let assunto, corpoHtml, textoWhats;
  if (row.tp_lembrete === 'dose_medicamento') {
    assunto = `Doses de hoje do ${animal}`;
    corpoHtml = `<p>Olá, <strong>${nome}</strong>!</p><p>Lembrete das doses de <strong>hoje</strong> do medicamento${item ? ` <strong>${row.ds_titulo}</strong>` : ''} do <strong>${animal}</strong>. Não esqueça de administrar conforme a orientação. 💊</p>`;
    textoWhats = `💊 *Meu Bixin*\n\nOlá, *${nome}*! Lembrete das doses de *hoje* do medicamento${itemW} do *${animal}*. Não esqueça de administrar conforme a orientação. 🐾`;
  } else {
    const tipo = row.tp_lembrete === 'dose_vermifugo' ? 'vermífugo' : 'vacina';
    const artA = tipo === 'vacina' ? 'A' : 'O';
    assunto = `Dose de ${tipo} do ${animal} próxima do vencimento`;
    corpoHtml = `<p>Olá, <strong>${nome}</strong>!</p><p>${artA} ${tipo}${item ? ` <strong>${row.ds_titulo}</strong>` : ''} do <strong>${animal}</strong> está com a dose próxima do vencimento. Manter em dia protege a saúde dele — vamos agendar? 💉</p>`;
    textoWhats = `💉 *Meu Bixin*\n\nOlá, *${nome}*! ${artA} ${tipo}${itemW} do *${animal}* está com a dose próxima do vencimento. Manter em dia protege a saúde dele — vamos agendar? 🐾`;
  }
  const textoEmail = corpoHtml.replace(/<[^>]+>/g, '').trim();
  return { assunto, html: wrapEmail(assunto, corpoHtml), textoEmail, textoWhats: `${textoWhats}\n\n---\n_Meu Bixin_` };
}

// Monta e-mail (HTML + texto) e WhatsApp de um lembrete (agendamento ou dose).
function montarMensagem(row) {
  if (row.tp_origem === 'dose') return montarMensagemDose(row);
  const dt = new Date(row.dt_inicio);
  const data = dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const hora = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  const quando = row.tp_lembrete === 'lembrete_24h' ? 'amanhã' : 'hoje';
  const tipo = TIPO_LABEL[row.tp_agendamento] || 'Consulta';
  const nome = row.responsavel_nome || 'responsável';
  const animal = row.animal_nome;
  const vet = row.vet_nome || 'seu veterinário';
  const local = row.ds_local || '';
  const link = row.tp_agendamento === 'teleconsulta' ? (row.conferencia_link || '') : '';
  const assunto = `Lembrete: ${tipo.toLowerCase()} de ${animal} ${quando} (${hora})`;
  const linhasDetalhe = [
    `<tr><td style="padding:4px 0;color:#888">Paciente</td><td style="padding:4px 0;text-align:right;font-weight:600;color:#2c3e50">${animal}</td></tr>`,
    `<tr><td style="padding:4px 0;color:#888">Tipo</td><td style="padding:4px 0;text-align:right;font-weight:600;color:#2c3e50">${tipo}</td></tr>`,
    `<tr><td style="padding:4px 0;color:#888">Data</td><td style="padding:4px 0;text-align:right;font-weight:600;color:#2c3e50">${data} às ${hora}</td></tr>`,
    `<tr><td style="padding:4px 0;color:#888">Profissional</td><td style="padding:4px 0;text-align:right;font-weight:600;color:#2c3e50">${vet}</td></tr>`,
    local ? `<tr><td style="padding:4px 0;color:#888">Local</td><td style="padding:4px 0;text-align:right;font-weight:600;color:#2c3e50">${local}</td></tr>` : '',
  ].join('');
  const botao = link
    ? `<div style="text-align:center;margin:26px 0"><a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#8BC34A 0%,#6a9e2f 100%);color:#fff;text-decoration:none;padding:14px 28px;border-radius:25px;font-weight:600;font-size:16px">📹 Entrar na Teleconsulta</a></div>`
    : '';
  const corpoHtml = `<div style="font-size:18px;margin-bottom:20px;color:#2c3e50">Olá, <strong>${nome}</strong>!</div>
      <div style="margin-bottom:20px;line-height:1.7;color:#555">Passando para lembrar da ${tipo.toLowerCase()} de <strong>${animal}</strong> ${quando}, <strong>${data}</strong> às <strong>${hora}</strong>.</div>
      <div style="background:#f8f9fa;border-left:4px solid #8BC34A;padding:15px 20px;margin:20px 0;border-radius:0 8px 8px 0"><table style="width:100%;border-collapse:collapse;font-size:14px">${linhasDetalhe}</table></div>${botao}`;
  const html = wrapEmail(`🔔 Lembrete de ${tipo}`, corpoHtml);
  const textoEmail = `Olá, ${nome}!\n\nLembrete da ${tipo.toLowerCase()} de ${animal} ${quando}, ${data} às ${hora}, com ${vet}.${local ? `\nLocal: ${local}.` : ''}${link ? `\n\nTeleconsulta: ${link}` : ''}\n\n---\nMeu Bixin`;
  const textoWhats = `🔔 *Lembrete de ${tipo} - Meu Bixin*\n\nOlá, *${nome}*!\n\nPassando para lembrar da ${tipo.toLowerCase()} de *${animal}* ${quando}, *${data}* às *${hora}*, com *${vet}*.${local ? `\n📍 Local: ${local}` : ''}${link ? `\n\n🔗 *Link da teleconsulta:*\n${link}` : ''}\n\n---\n*Meu Bixin*`;
  return { assunto, html, textoEmail, textoWhats };
}

// ---------- Processamento (envia pendentes vencidos, ambas as origens) ----------
async function processarLembretes({ limite = 50, vetId } = {}) {
  const lim = Math.min(Number(limite) || 50, 200);
  const filtroVet = vetId ? 'AND COALESCE(a.web_veterinarios_id, l.web_veterinarios_id) = :vetId' : '';
  const pend = await sequelize.query(
    `SELECT l.id AS lembrete_id, l.tp_lembrete, l.canal, l.tp_origem,
            a.dt_inicio, a.tp_agendamento, a.ds_local, a.ds_status,
            a.ds_email_responsavel, a.nu_telefone_responsavel,
            COALESCE(a.ds_titulo, l.ds_titulo) AS ds_titulo,
            ani.no_nome AS animal_nome, t.no_completo AS responsavel_nome,
            t.ds_email AS tutor_email, t.nu_telefone_completo AS tutor_telefone,
            COALESCE(wv.no_completo, wv2.no_completo) AS vet_nome, c.ds_link AS conferencia_link
       FROM web_lembretes l
       LEFT JOIN web_agendamentos a ON a.id = l.web_agendamentos_id
       LEFT JOIN mob_animais ani ON ani.id = COALESCE(a.mob_animais_id, l.mob_animais_id)
       LEFT JOIN mob_tutores t ON t.id = ani.mob_tutores_id
       LEFT JOIN web_veterinarios wv ON wv.id = a.web_veterinarios_id
       LEFT JOIN web_veterinarios wv2 ON wv2.id = l.web_veterinarios_id
       LEFT JOIN web_conferencias c ON c.id = a.web_conferencias_id
      WHERE l.st_status = 'pendente' AND l.dt_agendado_para <= NOW() ${filtroVet}
      ORDER BY l.dt_agendado_para ASC
      LIMIT :lim`,
    { replacements: { lim, vetId }, type: QueryTypes.SELECT }
  );

  let enviados = 0, erros = 0, pulados = 0;
  for (const row of pend) {
    const [claimed] = await WebLembretes.update(
      { st_status: 'enviando' },
      { where: { id: row.lembrete_id, st_status: 'pendente' } }
    );
    if (!claimed) { pulados++; continue; }
    // só agendamentos cancelados/concluídos são pulados (doses não têm ds_status)
    if (['cancelado', 'concluido'].includes(row.ds_status)) {
      await WebLembretes.update({ st_status: 'cancelado' }, { where: { id: row.lembrete_id } });
      pulados++; continue;
    }
    const email = row.ds_email_responsavel || row.tutor_email;
    const telefone = row.nu_telefone_responsavel || row.tutor_telefone;
    const msg = montarMensagem(row);
    let ok = false;
    if (row.canal === 'email') ok = await enviarEmail({ para: email, assunto: msg.assunto, html: msg.html, texto: msg.textoEmail });
    else if (row.canal === 'whatsapp') ok = await enviarWhatsApp({ telefone, texto: msg.textoWhats });
    if (ok) {
      await WebLembretes.update({ st_status: 'enviado', dt_enviado: new Date() }, { where: { id: row.lembrete_id } });
      enviados++;
    } else {
      await WebLembretes.update({ st_status: 'erro', ds_erro: `Falha no envio (${row.canal})` }, { where: { id: row.lembrete_id } });
      erros++;
    }
  }
  return { processados: pend.length, enviados, erros, pulados };
}

module.exports = { processarLembretes, gerarLembretesDose, montarMensagem };
