'use strict';
// Núcleo do motor de lembretes (Fase 2). Reutilizado por:
//  - routes/agenda/lembretes.js  → rota pública (WORKER_TOKEN), chamada pelo cron
//  - routes/agenda/agenda.js     → rota autenticada de disparo manual (tela temporária)
const { QueryTypes } = require('sequelize');
const models = require('../models');
const { WebLembretes, sequelize } = models;
const { enviarEmail, enviarWhatsApp } = require('./notificacoes');

const TIPO_LABEL = {
  consulta: 'Consulta', retorno: 'Retorno', vacina: 'Vacina',
  procedimento: 'Procedimento', teleconsulta: 'Teleconsulta',
};

// Monta e-mail (HTML + texto) e WhatsApp de um lembrete, no mesmo estilo das
// mensagens de agendamento de conferência.
function montarMensagem(row) {
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

  // ---- E-mail (HTML, mesmo layout da conferência) ----
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

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Lembrete - Meu Bixin</title></head>
<body style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#333;background-color:#f4f4f4;margin:0;padding:0">
  <div style="max-width:600px;margin:20px auto;background:#fff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);overflow:hidden">
    <div style="background:linear-gradient(135deg,#8BC34A 0%,#6a9e2f 100%);color:#fff;padding:30px 20px;text-align:center">
      <h1 style="margin:0;font-size:24px;font-weight:600">🔔 Lembrete de ${tipo}</h1>
      <p style="margin:5px 0 0 0;opacity:.9;font-size:14px">Meu Bixin</p>
    </div>
    <div style="padding:30px 20px">
      <div style="font-size:18px;margin-bottom:20px;color:#2c3e50">Olá, <strong>${nome}</strong>!</div>
      <div style="margin-bottom:20px;line-height:1.7;color:#555">
        Passando para lembrar da ${tipo.toLowerCase()} de <strong>${animal}</strong> ${quando}, <strong>${data}</strong> às <strong>${hora}</strong>.
      </div>
      <div style="background:#f8f9fa;border-left:4px solid #8BC34A;padding:15px 20px;margin:20px 0;border-radius:0 8px 8px 0">
        <table style="width:100%;border-collapse:collapse;font-size:14px">${linhasDetalhe}</table>
      </div>
      ${botao}
      <div style="margin-bottom:20px;color:#888;font-size:13px">
        Em caso de dúvidas, entre em contato com a clínica pelo email
        <a href="mailto:suporte@cicatribio.com.br" style="color:#8BC34A">suporte@cicatribio.com.br</a>
      </div>
    </div>
    <div style="background:#2c3e50;color:#ecf0f1;padding:20px;text-align:center;font-size:14px">
      <p style="margin:0"><strong>Meu Bixin</strong><br>Sistema de Gestão Veterinária<br><a href="mailto:suporte@cicatribio.com.br" style="color:#8BC34A">suporte@cicatribio.com.br</a></p>
      <p style="margin:15px 0 0 0;opacity:.7;font-size:12px">Este é um email automático, não responda a esta mensagem.</p>
    </div>
  </div>
</body></html>`;

  const textoEmail = `Olá, ${nome}!\n\nLembrete da ${tipo.toLowerCase()} de ${animal} ${quando}, ${data} às ${hora}, com ${vet}.${local ? `\nLocal: ${local}.` : ''}${link ? `\n\nTeleconsulta: ${link}` : ''}\n\nEm caso de dúvidas: suporte@cicatribio.com.br\n\n---\nMeu Bixin`;

  // ---- WhatsApp (mesmo estilo da conferência) ----
  const textoWhats = `🔔 *Lembrete de ${tipo} - Meu Bixin*

Olá, *${nome}*!

Passando para lembrar da ${tipo.toLowerCase()} de *${animal}* ${quando}, *${data}* às *${hora}*, com *${vet}*.${local ? `\n📍 Local: ${local}` : ''}${link ? `\n\n🔗 *Link da teleconsulta:*\n${link}` : ''}

Em caso de dúvidas: suporte@cicatribio.com.br

---
*Meu Bixin*`;

  return { assunto, html, textoEmail, textoWhats };
}

/**
 * Processa os lembretes pendentes vencidos (dt_agendado_para <= agora).
 * @param {object} [opts]
 * @param {number} [opts.limite=50]  máximo de lembretes por execução
 * @param {number} [opts.vetId]      se informado, processa só os lembretes de
 *                                    agendamentos deste veterinário (disparo manual)
 * @returns {Promise<{processados:number, enviados:number, erros:number, pulados:number}>}
 */
async function processarLembretes({ limite = 50, vetId } = {}) {
  const lim = Math.min(Number(limite) || 50, 200);
  const filtroVet = vetId ? 'AND a.web_veterinarios_id = :vetId' : '';
  const pend = await sequelize.query(
    `SELECT l.id AS lembrete_id, l.tp_lembrete, l.canal,
            a.dt_inicio, a.tp_agendamento, a.ds_titulo, a.ds_local, a.ds_status,
            a.ds_email_responsavel, a.nu_telefone_responsavel,
            an.no_nome AS animal_nome, t.no_completo AS responsavel_nome,
            wv.no_completo AS vet_nome, c.ds_link AS conferencia_link
       FROM web_lembretes l
       JOIN web_agendamentos a ON a.id = l.web_agendamentos_id
       JOIN mob_animais an ON an.id = a.mob_animais_id
       LEFT JOIN mob_tutores t ON t.id = an.mob_tutores_id
       LEFT JOIN web_veterinarios wv ON wv.id = a.web_veterinarios_id
       LEFT JOIN web_conferencias c ON c.id = a.web_conferencias_id
      WHERE l.st_status = 'pendente' AND l.dt_agendado_para <= NOW() ${filtroVet}
      ORDER BY l.dt_agendado_para ASC
      LIMIT :lim`,
    { replacements: { lim, vetId }, type: QueryTypes.SELECT }
  );

  let enviados = 0, erros = 0, pulados = 0;
  for (const row of pend) {
    // reivindica o lembrete (idempotência sob concorrência)
    const [claimed] = await WebLembretes.update(
      { st_status: 'enviando' },
      { where: { id: row.lembrete_id, st_status: 'pendente' } }
    );
    if (!claimed) { pulados++; continue; }
    if (['cancelado', 'concluido'].includes(row.ds_status)) {
      await WebLembretes.update({ st_status: 'cancelado' }, { where: { id: row.lembrete_id } });
      pulados++; continue;
    }
    const msg = montarMensagem(row);
    let ok = false;
    if (row.canal === 'email') ok = await enviarEmail({ para: row.ds_email_responsavel, assunto: msg.assunto, html: msg.html, texto: msg.textoEmail });
    else if (row.canal === 'whatsapp') ok = await enviarWhatsApp({ telefone: row.nu_telefone_responsavel, texto: msg.textoWhats });
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

module.exports = { processarLembretes, montarMensagem };
