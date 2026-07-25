'use strict';
const express = require('express');
const route = express.Router();
const { processarCampanhas } = require('../../utils/retencao');

// Motor de retenção — rota PÚBLICA (WORKER_TOKEN), para o cron. Montada ANTES
// dos routers com requireAuth global (igual a /agenda/lembretes/processar).
route.post('/retencao/processar', async (req, res) => {
  const tokenEnv = process.env.WORKER_TOKEN;
  if (tokenEnv && req.headers['x-worker-token'] !== tokenEnv) {
    return res.status(401).json({ success: false, message: 'Token de worker inválido.' });
  }
  try {
    const r = await processarCampanhas({ limite: req.query.limite });
    return res.json({ success: true, ...r });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao processar campanhas: ' + err.message });
  }
});

module.exports = route;
