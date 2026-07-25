'use strict';
const express = require('express');
const route = express.Router();
const { QueryTypes } = require('sequelize');
const models = require('../../models');
const { WebLembretes, sequelize } = models;
const { enviarEmail, enviarWhatsApp } = require('../../utils/notificacoes');

/*
 * MOTOR dos lembretes da agenda (Fase 2).
 * Rota PÚBLICA protegida por WORKER_TOKEN (header x-worker-token) — NÃO usa
 * requireAuth. Por isso vive num router separado, montado ANTES dos routers que
 * fazem route.use(requireAuth) global (connect/cobrancas/assinatura). Chamada por
 * um cron (externo ou Vercel Cron) a cada ~15 min.
 */

const TIPO_LABEL = {
  consulta: 'consulta', retorno: 'retorno', vacina: 'vacina',
  procedimento: 'procedimento', teleconsulta: 'teleconsulta',
};

function montarMensagem(row) {
  const dt = new Date(row.dt_inicio);
  const data = dt.toLocaleDateString('pt-BR');
  const hora = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  const quando = row.tp_lembrete === 'lembrete_24h' ? 'amanhã' : 'hoje';
  const tipo = TIPO_LABEL[row.tp_agendamento] || 'consulta';
  const resp = row.responsavel_nome ? `, ${row.responsavel_nome}` : '';
  const vet = row.vet_nome ? ` com Dr(a). ${row.vet_nome}` : '';
  const local = row.ds_local ? ` Local: ${row.ds_local}.` : '';
  const texto = `Olá${resp}! Lembrete: ${row.animal_nome} tem ${tipo} ${quando}, dia ${data} às ${hora}${vet}.${local}`;
  const assunto = `Lembrete de ${tipo} — ${row.animal_nome} (${data} ${hora})`;
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:15px;color:#333"><p>${texto}</p><p style="color:#888;font-size:12px">Meu Bixin — mensagem automática.</p></div>`;
  return { texto, assunto, html };
}

// POST /agenda/lembretes/processar[?limite=N]
route.post('/agenda/lembretes/processar', async (req, res) => {
  const tokenEnv = process.env.WORKER_TOKEN;
  if (tokenEnv && req.headers['x-worker-token'] !== tokenEnv) {
    return res.status(401).json({ success: false, message: 'Token de worker inválido.' });
  }
  try {
    const limite = Math.min(Number(req.query.limite) || 50, 200);
    const pend = await sequelize.query(
      `SELECT l.id AS lembrete_id, l.tp_lembrete, l.canal,
              a.dt_inicio, a.tp_agendamento, a.ds_titulo, a.ds_local, a.ds_status,
              a.ds_email_responsavel, a.nu_telefone_responsavel,
              an.no_nome AS animal_nome, t.no_completo AS responsavel_nome,
              wv.no_completo AS vet_nome
         FROM web_lembretes l
         JOIN web_agendamentos a ON a.id = l.web_agendamentos_id
         JOIN mob_animais an ON an.id = a.mob_animais_id
         LEFT JOIN mob_tutores t ON t.id = an.mob_tutores_id
         LEFT JOIN web_veterinarios wv ON wv.id = a.web_veterinarios_id
        WHERE l.st_status = 'pendente' AND l.dt_agendado_para <= NOW()
        ORDER BY l.dt_agendado_para ASC
        LIMIT :limite`,
      { replacements: { limite }, type: QueryTypes.SELECT }
    );

    let enviados = 0, erros = 0, pulados = 0;
    for (const row of pend) {
      // reivindica o lembrete (idempotência sob concorrência serverless)
      const [claimed] = await WebLembretes.update(
        { st_status: 'enviando' },
        { where: { id: row.lembrete_id, st_status: 'pendente' } }
      );
      if (!claimed) { pulados++; continue; }
      // agendamento cancelado/concluído → não envia
      if (['cancelado', 'concluido'].includes(row.ds_status)) {
        await WebLembretes.update({ st_status: 'cancelado' }, { where: { id: row.lembrete_id } });
        pulados++; continue;
      }
      const msg = montarMensagem(row);
      let ok = false;
      if (row.canal === 'email') ok = await enviarEmail({ para: row.ds_email_responsavel, assunto: msg.assunto, html: msg.html, texto: msg.texto });
      else if (row.canal === 'whatsapp') ok = await enviarWhatsApp({ telefone: row.nu_telefone_responsavel, texto: msg.texto });
      if (ok) {
        await WebLembretes.update({ st_status: 'enviado', dt_enviado: new Date() }, { where: { id: row.lembrete_id } });
        enviados++;
      } else {
        await WebLembretes.update({ st_status: 'erro', ds_erro: `Falha no envio (${row.canal})` }, { where: { id: row.lembrete_id } });
        erros++;
      }
    }
    return res.json({ success: true, processados: pend.length, enviados, erros, pulados });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao processar lembretes: ' + err.message });
  }
});

module.exports = route;
