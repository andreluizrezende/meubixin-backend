const express = require('express');
const route = express.Router();

// Carregado SÓ quando o crawler roda localmente (sem ANVISA_WORKER_URL). Em
// produção (Vercel, modo proxy) isto NUNCA é chamado — evita carregar
// puppeteer-core/pdf-parse no bundle serverless (quebra o deploy).
function getAnvisa() {
  return require('../../utils/anvisaBulario');
}

/*
 * Rotas do Bulário Eletrônico da ANVISA.
 *
 * Camadas (produção):
 *   requisição → CACHE no banco (hit = instantâneo) → miss → WORKER externo
 *   (Chrome num host de IP bom) → grava no cache → responde.
 *
 * Controles por env:
 *   - ANVISA_WORKER_URL: se definido, /bulario/* ENCAMINHA para o worker externo
 *     (produção Vercel). Se vazio, roda o crawler direto aqui (dev / host local).
 *   - ANVISA_NO_CACHE=1: desliga o cache (usado DENTRO do worker, que não tem/
 *     não deve mexer no banco). Ver worker/anvisaWorker.js.
 *   - WORKER_TOKEN: enviado como header x-worker-token ao worker.
 */

const WORKER = (process.env.ANVISA_WORKER_URL || '').replace(/\/$/, '');
const CACHE_ON = process.env.ANVISA_NO_CACHE !== '1';

// ---- cache (lazy: só carrega o model quando o cache está ligado) ------------
let _cacheModel; // undefined = ainda não tentou; null = indisponível
function getCacheModel() {
  if (!CACHE_ON) return null;
  if (_cacheModel !== undefined) return _cacheModel;
  try {
    _cacheModel = require('../../models').WebBulasCache || null;
  } catch {
    _cacheModel = null;
  }
  return _cacheModel;
}

async function lerCache(expediente, tipo) {
  const M = getCacheModel();
  if (!M || !expediente) return null;
  try {
    const row = await M.findOne({ where: { expediente: String(expediente), tipo } });
    if (!row) return null;
    return {
      medicamento: row.nome_produto,
      empresa: row.empresa,
      cnpj: row.cnpj,
      expediente: row.expediente,
      numeroRegistro: row.numero_registro,
      texto: row.texto,
      paginas: row.paginas,
      caracteres: row.caracteres,
      tamanhoPdfBytes: row.tamanho_pdf_bytes,
    };
  } catch {
    return null; // cache indisponível não pode quebrar o fluxo
  }
}

async function gravarCache(resultado, tipo) {
  const M = getCacheModel();
  if (!M || !resultado || !resultado.expediente) return;
  try {
    await M.upsert({
      expediente: String(resultado.expediente),
      tipo,
      id_produto: resultado.idProduto || null,
      nome_produto: resultado.medicamento,
      empresa: resultado.empresa,
      cnpj: resultado.cnpj,
      numero_registro: resultado.numeroRegistro,
      texto: resultado.texto,
      paginas: resultado.paginas,
      caracteres: resultado.caracteres,
      tamanho_pdf_bytes: resultado.tamanhoPdfBytes,
    });
  } catch {
    /* best-effort */
  }
}

// ---- worker / local ---------------------------------------------------------
// Encaminha a requisição atual para o worker (retorna o corpo cru), com timeout
// curto para não estourar o limite da função serverless (Vercel Hobby ~10s).
async function proxyParaWorker(req, res) {
  const url = WORKER + req.originalUrl;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  const headers = { Accept: 'application/json' };
  if (process.env.WORKER_TOKEN) headers['x-worker-token'] = process.env.WORKER_TOKEN;
  try {
    const r = await fetch(url, { headers, signal: ctrl.signal });
    const body = await r.text();
    return res.status(r.status).type('application/json').send(body);
  } catch (err) {
    const timeout = err && err.name === 'AbortError';
    return res.status(timeout ? 504 : 502).json({
      message: timeout
        ? 'O worker do bulário demorou demais para responder.'
        : 'Falha ao contatar o worker do bulário: ' + (err && err.message),
    });
  } finally {
    clearTimeout(timer);
  }
}

// Obtém a bula do profissional (JSON) — via worker (proxy) ou direto (local).
async function obterBulaProfissional(req) {
  const { nome, expediente, idProduto, indice } = req.query;
  if (WORKER) {
    const url = WORKER + req.originalUrl;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    const headers = { Accept: 'application/json' };
    if (process.env.WORKER_TOKEN) headers['x-worker-token'] = process.env.WORKER_TOKEN;
    try {
      const r = await fetch(url, { headers, signal: ctrl.signal });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const e = new Error(data.message || 'Erro no worker do bulário.');
        e.status = r.status;
        throw e;
      }
      return data;
    } catch (err) {
      if (err && err.name === 'AbortError') {
        const e = new Error('O worker do bulário demorou demais para responder.');
        e.status = 504;
        throw e;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  return getAnvisa().bulaProfissionalPorNome(nome, {
    expediente,
    idProduto,
    indice: indice != null ? Number(indice) : undefined,
  });
}

// ---- rotas ------------------------------------------------------------------

// GET /bulario/buscar?nome=dipirona  (listagem — sem cache)
route.get('/bulario/buscar', async (req, res) => {
  const { nome } = req.query;
  if (!nome) return res.status(400).json({ message: 'Parâmetro "nome" é obrigatório.' });
  if (WORKER) return proxyParaWorker(req, res);
  try {
    const { total, itens } = await getAnvisa().buscar(nome);
    const publicos = itens.map((i) => ({
      idProduto: i.idProduto,
      nomeProduto: i.nomeProduto,
      empresa: i.empresa,
      cnpj: i.cnpj,
      expediente: i.expediente,
      numeroRegistro: i.numeroRegistro,
      data: i.data,
      temBulaProfissional: !!i.tokenProfissional,
      temBulaPaciente: !!i.tokenPaciente,
    }));
    return res.json({ total, itens: publicos });
  } catch (err) {
    return res.status(err.status || 502).json({ message: err.message, trecho: err.trecho });
  }
});

// GET /bulario/bula-profissional?nome=dipirona[&expediente=..|&idProduto=..|&indice=0]
// Cache-first: se o expediente já está no banco, devolve na hora (sem crawler).
route.get('/bulario/bula-profissional', async (req, res) => {
  const { nome, expediente } = req.query;
  if (!nome) return res.status(400).json({ message: 'Parâmetro "nome" é obrigatório.' });

  // 1) tenta o cache (quando o expediente é conhecido)
  const doCache = await lerCache(expediente, 'profissional');
  if (doCache) return res.json({ ...doCache, cache: true });

  // 2) miss → coleta (worker ou local)
  let resultado;
  try {
    resultado = await obterBulaProfissional(req);
  } catch (err) {
    return res.status(err.status || 502).json({ message: err.message, trecho: err.trecho });
  }

  // 3) grava no cache (best-effort, não bloqueia a resposta)
  gravarCache(resultado, 'profissional').catch(() => {});

  // 4) responde
  return res.json({ ...resultado, cache: false });
});

module.exports = route;
