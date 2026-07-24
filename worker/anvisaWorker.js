/*
 * worker/anvisaWorker.js
 * -----------------------------------------------------------------------------
 * Worker do Bulário da ANVISA — o crawler que roda num host de IP "bom"
 * (máquina residencial/empresarial sempre ligada, ou VPS + proxy residencial),
 * onde o Cloudflare deixa o Chrome passar.
 *
 * Reusa a MESMA rota do backend (routes/bulario/bulario.js) e o MESMO motor
 * (utils/anvisaBulario.js). Como aqui ANVISA_WORKER_URL fica VAZIO, a rota roda
 * o crawler direto (não entra em modo proxy).
 *
 * Produção: o backend na Vercel define ANVISA_WORKER_URL apontando para a URL
 * pública deste worker; então /bulario/* na Vercel só encaminha para cá.
 *
 * Como rodar (no host de IP bom):
 *   cd backend
 *   node worker/anvisaWorker.js            # abre o Chrome visível (headful)
 *   # 1ª vez: resolva o desafio do Cloudflare na janela; o perfil fica salvo.
 *   # Depois, opcional sem janela:  set ANVISA_HEADLESS=1 && node worker/anvisaWorker.js
 *
 * Segurança: exponha atrás de um token simples (WORKER_TOKEN) para o backend
 * ser o único a chamar. Se WORKER_TOKEN estiver definido, exige o header
 * "x-worker-token" igual.
 */

'use strict';

// Garante que a rota NÃO entre em modo proxy dentro do worker.
delete process.env.ANVISA_WORKER_URL;
// O worker é só o crawler — não usa o banco. O cache vive no backend (Vercel).
process.env.ANVISA_NO_CACHE = '1';

const express = require('express');
const cors = require('cors');
const rotaBulario = require('../routes/bulario/bulario');

const app = express();
const PORT = process.env.WORKER_PORT || 4700;
const TOKEN = process.env.WORKER_TOKEN || '';

app.use(cors());

// Autenticação opcional por token compartilhado com o backend.
app.use((req, res, next) => {
  if (!TOKEN) return next();
  if (req.headers['x-worker-token'] === TOKEN) return next();
  return res.status(401).json({ message: 'worker: token inválido' });
});

app.get('/health', (req, res) => res.json({ ok: true }));
app.use(rotaBulario);

app.listen(PORT, () => {
  console.log(`Worker Bulário ANVISA rodando na porta ${PORT}`);
  console.log(TOKEN ? 'Protegido por WORKER_TOKEN.' : 'Sem token (defina WORKER_TOKEN em produção).');
});
