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

// Trava anti-loop: se ANVISA_WORKER_URL aponta para o próprio backend, o proxy
// chamaria a si mesmo (a Vercel responde HTTP 508 "Loop Detected"). Detecta e
// devolve um erro claro em vez de entrar em loop.
function workerEhLoop(req) {
  try {
    if (!WORKER) return false;
    const wHost = new URL(WORKER).host;
    const reqHost = req.headers['x-forwarded-host'] || req.headers.host || '';
    return !!wHost && !!reqHost && wHost === reqHost;
  } catch {
    return false;
  }
}
const ERRO_LOOP = {
  message:
    'ANVISA_WORKER_URL aponta para o próprio backend (loop). Configure a URL de um worker EXTERNO ou remova a variável.',
};

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
    if (workerEhLoop(req)) {
      const e = new Error(ERRO_LOOP.message);
      e.status = 500;
      throw e;
    }
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
  if (WORKER) {
    if (workerEhLoop(req)) return res.status(500).json(ERRO_LOOP);
    return proxyParaWorker(req, res);
  }
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

// GET /bulario/medicamentos?nome=X
// Busca no catálogo dos DADOS ABERTOS da ANVISA (tabela anvisa_medicamentos) —
// NÃO usa worker/Chrome/Cloudflare, roda na Vercel. Devolve a lista + o link
// para abrir a bula na ANVISA (o navegador do usuário passa o Cloudflare).
route.get('/bulario/medicamentos', async (req, res) => {
  const { nome } = req.query;
  if (!nome || String(nome).trim().length < 2) {
    return res.status(400).json({ message: 'Informe ao menos 2 letras.' });
  }
  try {
    const { WebAnvisaMedicamentos } = require('../../models');
    const { Op, literal } = require('sequelize');
    const termo = String(nome).trim();
    const rows = await WebAnvisaMedicamentos.findAll({
      where: { nome_produto: { [Op.like]: `%${termo}%` } },
      order: [
        [literal("CASE WHEN situacao_registro = 'Ativo' THEN 0 ELSE 1 END"), 'ASC'],
        ['nome_produto', 'ASC'],
      ],
      limit: 30,
    });
    const itens = rows.map((r) => ({
      nome: r.nome_produto,
      principioAtivo: r.principio_ativo,
      empresa: r.empresa,
      registro: r.numero_registro,
      categoria: r.categoria_regulatoria,
      classe: r.classe_terapeutica,
      situacao: r.situacao_registro,
      bulaUrl: `https://consultas.anvisa.gov.br/#/bulario/q/?nomeProduto=${encodeURIComponent(r.nome_produto)}`,
    }));
    return res.json({ itens });
  } catch (err) {
    return res.status(500).json({ message: 'Erro na busca de medicamentos (dados abertos): ' + err.message });
  }
});

// GET /bulario/cache?nome=X
// Busca as bulas JÁ COLETADAS no cache local (web_bulas_cache, tipo=profissional),
// preenchido pelo script scripts/enriquecerBulasAnvisa.js. Só metadados (sem o
// texto, que é grande). Roda na Vercel — é apenas leitura do banco, sem Chrome.
route.get('/bulario/cache', async (req, res) => {
  const { nome } = req.query;
  if (!nome || String(nome).trim().length < 2) {
    return res.status(400).json({ message: 'Informe ao menos 2 letras.' });
  }
  try {
    const { WebBulasCache } = require('../../models');
    const { Op } = require('sequelize');
    const termo = String(nome).trim();
    const rows = await WebBulasCache.findAll({
      where: { tipo: 'profissional', nome_produto: { [Op.like]: `%${termo}%` } },
      order: [['nome_produto', 'ASC']],
      limit: 30,
      attributes: ['id', 'nome_produto', 'empresa', 'cnpj', 'numero_registro', 'expediente', 'paginas', 'caracteres'],
    });
    const itens = rows.map((r) => ({
      id: r.id,
      nome: r.nome_produto,
      empresa: r.empresa,
      cnpj: r.cnpj,
      registro: r.numero_registro,
      expediente: r.expediente,
      paginas: r.paginas,
      caracteres: r.caracteres,
    }));
    return res.json({ itens });
  } catch (err) {
    return res.status(500).json({ message: 'Erro na busca do cache de bulas: ' + err.message });
  }
});

// GET /bulario/cache/:id — texto completo de uma bula do cache (sob demanda).
route.get('/bulario/cache/:id', async (req, res) => {
  try {
    const { WebBulasCache } = require('../../models');
    const row = await WebBulasCache.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: 'Bula não encontrada no cache.' });
    // Campos estruturados extraídos do texto (best-effort, sem deps pesadas).
    const { extrairCampos } = require('../../utils/extrairCamposBula');
    const campos = extrairCampos(row.texto);
    return res.json({
      id: row.id,
      nome: row.nome_produto,
      empresa: row.empresa,
      registro: row.numero_registro,
      expediente: row.expediente,
      paginas: row.paginas,
      caracteres: row.caracteres,
      texto: row.texto,
      concentracao: campos.concentracao,
      forma: campos.forma,
      via: campos.via,
      posologia: campos.posologia,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Erro ao ler a bula do cache: ' + err.message });
  }
});

module.exports = route;
