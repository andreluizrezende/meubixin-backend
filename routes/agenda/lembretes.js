'use strict';
const express = require('express');
const route = express.Router();
const { processarLembretes } = require('../../utils/processarLembretes');

/*
 * MOTOR dos lembretes da agenda (Fase 2) — rota PÚBLICA protegida por WORKER_TOKEN
 * (header x-worker-token), NÃO usa requireAuth. Vive num router separado montado
 * ANTES dos routers com route.use(requireAuth) global (connect/cobrancas/assinatura).
 * Chamada por um cron (externo ou Vercel Cron) a cada ~15 min.
 * O disparo MANUAL (tela temporária, autenticado) fica em routes/agenda/agenda.js.
 */
route.post('/agenda/lembretes/processar', async (req, res) => {
  const tokenEnv = process.env.WORKER_TOKEN;
  if (tokenEnv && req.headers['x-worker-token'] !== tokenEnv) {
    return res.status(401).json({ success: false, message: 'Token de worker inválido.' });
  }
  try {
    const r = await processarLembretes({ limite: req.query.limite });
    return res.json({ success: true, ...r });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao processar lembretes: ' + err.message });
  }
});

module.exports = route;
