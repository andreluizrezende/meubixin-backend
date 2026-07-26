/*
 * utils/anvisaBulario.js
 * -----------------------------------------------------------------------------
 * Núcleo reutilizável do crawler do Bulário Eletrônico da ANVISA.
 *
 * Por que Puppeteer / navegador real?
 *   A API pública (consultas.anvisa.gov.br) fica atrás do Cloudflare. Um fetch
 *   de servidor "cru" é barrado ("Attention Required! | Cloudflare"). Num Chrome
 *   real o Cloudflare libera o cookie de acesso; daí as chamadas à API feitas de
 *   DENTRO da própria página (page.evaluate + fetch) passam — mesma origem que o
 *   SPA Angular usa.
 *
 * Desenho (espelha o exemplo-minimo.js, que é comprovadamente estável):
 *   - Um NAVEGADOR único e quente (headful + perfil persistente p/ o Cloudflare).
 *   - Cada operação abre uma PÁGINA NOVA, carrega o bulário, faz o fetch e fecha
 *     a página. Nada de reusar uma página velha (era o que causava o erro
 *     "detached Frame" quando o SPA/Cloudflare recarregava a aba).
 *   - Acesso serializado: uma operação por vez.
 *
 * Contrato da API (confirmado ao vivo):
 *   - Busca: GET /api/consulta/bulario?count=N&page=1&filter[nomeProduto]=X
 *            header Authorization: Guest -> { content:[...], totalElements }
 *   - PDF:  GET /api/consulta/medicamentos/arquivo/bula/parecer/{token}/?Authorization=
 *            {token} = idBulaProfissionalProtegido (ou ...Paciente...); JWT ~5 min.
 *
 * ⚠️ Não funciona em Vercel serverless (Chromium não roda bem + IP de datacenter
 *    bloqueado pelo Cloudflare). Use num host persistente (máquina local / VPS).
 *
 * Saída: TEXTO da bula extraído EM MEMÓRIA (pdf-parse). O PDF nunca é salvo.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { PDFParse } = require('pdf-parse');

const BASE = 'https://consultas.anvisa.gov.br';
// Por padrão abre o Chrome VISÍVEL (headful) — o Cloudflare bloqueia headless.
// ANVISA_HEADLESS=1 roda sem janela (só depois que o perfil já passou o desafio).
const HEADLESS = process.env.ANVISA_HEADLESS === '1';
const PERFIL_DIR = path.join(__dirname, '.anvisa-chrome-profile');
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pareceCloudflare(txt) {
  return /Attention Required|cf-error|Cloudflare|Just a moment/i.test(txt || '');
}
function ehErroTransitorio(e) {
  const m = String((e && e.message) || e);
  return /detached Frame|Execution context was destroyed|Cannot find context|Target closed|Session closed|frame got detached|Node with given id/i.test(m);
}

// ---- localizar o Chrome instalado (Windows / Linux / macOS) -----------------
// Lista os navegadores existentes, em ordem de preferência. Retorna TODOS os que
// existem (não só o primeiro) para o getBrowser poder cair pro próximo se um
// falhar ao lançar — em algumas máquinas o chrome.exe dá EACCES no spawn (bloqueio
// de execução), mas o Edge (também Chromium) funciona.
function acharChromes() {
  const candidatos = [
    process.env.CHROME_PATH || null,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe')
      : null,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  // dedup preservando ordem, só os que existem
  const vistos = new Set();
  return candidatos.filter((p) => {
    if (vistos.has(p) || !fs.existsSync(p)) return false;
    vistos.add(p);
    return true;
  });
}

// ---- navegador único (quente) + acesso serializado --------------------------
let browserPromise = null;
let fila = Promise.resolve();

function serializar(fn) {
  const proximo = fila.then(fn, fn);
  fila = proximo.catch(() => {});
  return proximo;
}

// O navegador morreu? (fechado à mão, crash, nodemon, etc.) → relançar.
function browserVivo(b) {
  try {
    if (typeof b.connected === 'boolean') return b.connected;
    if (typeof b.isConnected === 'function') return b.isConnected();
  } catch { return false; }
  return true;
}
function ehBrowserMorto(e) {
  const m = String((e && e.message) || e);
  return /Protocol error|Connection closed|Target closed|browser has disconnected|Session closed|WebSocket|Browser closed/i.test(m);
}

async function getBrowser() {
  if (browserPromise) {
    try {
      const b = await browserPromise;
      if (browserVivo(b)) return b;
    } catch { /* cai pro relançamento */ }
    browserPromise = null; // navegador morto → esquece e relança
  }
  browserPromise = (async () => {
    const navegadores = acharChromes();
    if (!navegadores.length) {
      throw new Error('Nenhum Chrome/Edge encontrado. Defina CHROME_PATH apontando para o executável do Chrome/Chromium.');
    }
    const opts = {
      headless: HEADLESS ? 'new' : false,
      userDataDir: PERFIL_DIR,
      defaultViewport: null,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--start-maximized',
      ],
    };
    let ultimoErro;
    for (const executablePath of navegadores) {
      try {
        return await puppeteer.launch({ ...opts, executablePath });
      } catch (e) {
        ultimoErro = e;
        const m = String((e && e.message) || e);
        // EACCES/ENOENT no spawn → tenta o próximo navegador (ex.: Chrome bloqueado → Edge)
        if (!/spawn|EACCES|ENOENT|Failed to launch/i.test(m)) throw e;
        console.warn(`[anvisa] falha ao lançar ${executablePath} (${m.slice(0, 60)}). Tentando o próximo...`);
      }
    }
    throw ultimoErro || new Error('Não foi possível lançar nenhum navegador.');
  })();
  browserPromise.catch(() => { browserPromise = null; });
  return browserPromise;
}

// Abre uma PÁGINA NOVA, passa o Cloudflare e roda `trabalho(page)`. Fecha a
// página no fim. Reaproveita o navegador (relança se ele tiver morrido). Uma
// operação por vez (serializado).
async function comPagina(trabalho) {
  return serializar(async () => {
    let ultimoErro;
    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      const browser = await getBrowser();
      let page;
      try {
        page = await browser.newPage();
        await page.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });
        await page.setUserAgent(UA);
        await page.goto(BASE + '/#/bulario/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await sleep(6000); // deixa o Angular + o Cloudflare assentarem
        return await trabalho(page);
      } catch (e) {
        ultimoErro = e;
        if (ehBrowserMorto(e)) {
          browserPromise = null; // navegador caiu → relança e tenta 1x mais
          continue;
        }
        throw e; // erro de negócio → propaga
      } finally {
        if (page) await page.close().catch(() => {});
      }
    }
    throw ultimoErro;
  });
}

// fetch de JSON de dentro da página, repetindo enquanto vier HTML do Cloudflare
// ou um erro transitório de recarga (headful: dá tempo de resolver o desafio).
async function fetchJson(page, url) {
  for (let tentativa = 1; tentativa <= 8; tentativa++) {
    let r;
    try {
      r = await page.evaluate(async (u) => {
        const resp = await fetch(u, {
          headers: { Authorization: 'Guest', Accept: 'application/json, text/plain, */*' },
        });
        return { status: resp.status, body: await resp.text() };
      }, url);
    } catch (e) {
      if (!ehErroTransitorio(e)) throw e;
      await sleep(3000);
      continue; // página recarregou (Cloudflare); tenta de novo
    }
    if (!pareceCloudflare(r.body)) return r; // passou
    await sleep(5000); // desafio: espera (resolva na janela) e refaz
  }
  const e = new Error('O Cloudflare bloqueou a consulta. Resolva o desafio na janela do Chrome e tente de novo.');
  e.status = 502;
  throw e;
}

// fetch do PDF (bytes → base64) de dentro da página
async function fetchPdfB64(page, url) {
  for (let tentativa = 1; tentativa <= 4; tentativa++) {
    try {
      return await page.evaluate(async (u) => {
        const resp = await fetch(u, { headers: { Authorization: 'Guest' } });
        const bytes = new Uint8Array(await resp.arrayBuffer());
        let bin = '';
        const CH = 0x8000;
        for (let i = 0; i < bytes.length; i += CH) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
        }
        return { status: resp.status, b64: btoa(bin) };
      }, url);
    } catch (e) {
      if (!ehErroTransitorio(e) || tentativa === 4) throw e;
      await sleep(3000);
    }
  }
}

// ---- helpers de domínio -----------------------------------------------------
const urlBusca = (nome, count) =>
  `${BASE}/api/consulta/bulario?count=${encodeURIComponent(count)}&page=1&filter[nomeProduto]=${encodeURIComponent(String(nome).trim())}`;
const urlPdf = (token) =>
  `${BASE}/api/consulta/medicamentos/arquivo/bula/parecer/${encodeURIComponent(token)}/?Authorization=`;

function mapItem(it) {
  return {
    idProduto: it.idProduto,
    nomeProduto: it.nomeProduto,
    empresa: it.razaoSocial,
    cnpj: it.cnpj,
    expediente: it.expediente,
    numeroRegistro: it.numeroRegistro,
    numProcesso: it.numProcesso,
    data: it.data,
    tokenProfissional: it.idBulaProfissionalProtegido || null,
    tokenPaciente: it.idBulaPacienteProtegido || null,
  };
}

function parseBusca(body) {
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    const e = new Error('Resposta não-JSON da ANVISA.');
    e.trecho = (body || '').slice(0, 300);
    throw e;
  }
  return { total: data.totalElements, itens: (data.content || []).map(mapItem) };
}

function escolherItem(itens, opts = {}) {
  if (opts.expediente) return itens.find((i) => i.expediente === String(opts.expediente)) || itens[0];
  if (opts.idProduto) return itens.find((i) => String(i.idProduto) === String(opts.idProduto)) || itens[0];
  if (Number.isInteger(opts.indice)) return itens[opts.indice] || itens[0];
  return itens[0];
}

// Extrai, best-effort, a concentração e a forma farmacêutica do texto da bula
// (seção "APRESENTAÇÕES"). Serve para autopreencher a prescrição; o vet ajusta.
function extrairApresentacao(texto) {
  const t = String(texto || '');
  const m = t.match(/APRESENTA[ÇC][ÃA]O(?:ES|ÕES)?\s*[:\-]?\s*([\s\S]{0,400})/i);
  const trecho = m ? m[1] : t.slice(0, 400);
  const tl = trecho.toLowerCase();

  // Forma farmacêutica — do mais específico para o mais genérico.
  const FORMAS = [
    'solução oral', 'solução injetável', 'solução em gotas', 'solução (gotas)',
    'comprimido revestido', 'comprimido', 'cápsula', 'capsula', 'xarope',
    'suspensão oral', 'suspensão', 'pomada', 'creme', 'gel', 'aerossol',
    'spray', 'supositório', 'adesivo', 'gotas', 'solução',
  ];
  let forma = FORMAS.find((f) => tl.includes(f)) || '';
  if (forma) forma = forma.charAt(0).toUpperCase() + forma.slice(1);

  // Concentração — ex.: "500 mg", "2 mg/mL", "250 mg + 62,5 mg", "1 g".
  const c = trecho.match(
    /\d{1,4}(?:[.,]\d{1,3})?\s?(?:mg|mcg|µg|g|ui|UI)(?:\s?\/\s?\d{0,4}(?:[.,]\d{1,3})?\s?mL|\s?\+\s?\d{1,4}(?:[.,]\d{1,3})?\s?(?:mg|mcg|g))?/i
  );
  const concentracao = c ? c[0].replace(/\s+/g, ' ').trim() : '';

  return { concentracao, forma };
}

async function textoDeB64(pdf) {
  const buf = Buffer.from((pdf && pdf.b64) || '', 'base64');
  if (!pdf || pdf.status !== 200 || buf.slice(0, 4).toString('latin1') !== '%PDF') {
    const e = new Error('Não veio um PDF válido da ANVISA (token pode ter expirado).');
    e.status = (pdf && pdf.status) || 502;
    throw e;
  }
  const parser = new PDFParse({ data: buf });
  const out = await parser.getText();
  if (typeof parser.destroy === 'function') await parser.destroy();
  const texto = ((out && (out.text || out.mergedText)) || '').trim();
  const paginas = (out && (out.total || (out.pages && out.pages.length))) || null;
  return { texto, paginas, caracteres: texto.length, tamanhoPdfBytes: buf.length };
}

// ---- API pública do módulo --------------------------------------------------

/** Busca medicamentos no bulário pelo nome. */
async function buscar(nome, count = 25) {
  if (!nome || !String(nome).trim()) throw new Error('nome é obrigatório');
  const r = await comPagina((page) => fetchJson(page, urlBusca(nome, count)));
  return parseBusca(r.body);
}

/** Baixa o PDF (via token) e extrai o TEXTO em memória (numa página própria). */
async function extrairTextoBula(token) {
  if (!token) throw new Error('token é obrigatório');
  const pdf = await comPagina((page) => fetchPdfB64(page, urlPdf(token)));
  return textoDeB64(pdf);
}

/**
 * Busca pelo nome, escolhe um resultado e devolve o texto da bula do
 * profissional — TUDO numa MESMA sessão de página (token fresco, uma só carga).
 * @param {object} [opts] { expediente?, idProduto?, indice? }
 */
// Busca a bula de um produto pelo NOME. opts:
//   tipo: 'profissional' (padrão) | 'paciente'
//   fallbackPaciente: se true e o produto NÃO tiver bula do profissional, cai
//     automaticamente para a do paciente (usado no enriquecimento dos "sem bula").
// Retorna, além dos campos da bula, o `tipo` efetivamente coletado — para gravar
// no cache com o tipo certo.
async function bulaPorNome(nome, opts = {}) {
  if (!nome || !String(nome).trim()) throw new Error('nome é obrigatório');
  const capturado = await comPagina(async (page) => {
    const rb = await fetchJson(page, urlBusca(nome, 25));
    const { itens } = parseBusca(rb.body);
    if (!itens.length) { const e = new Error('Nenhum medicamento encontrado para: ' + nome); e.status = 404; throw e; }
    const item = escolherItem(itens, opts);
    let tipo = opts.tipo === 'paciente' ? 'paciente' : 'profissional';
    let token = tipo === 'paciente' ? item.tokenPaciente : item.tokenProfissional;
    // Fallback: sem bula do profissional → tenta a do paciente.
    if (!token && opts.fallbackPaciente && tipo === 'profissional' && item.tokenPaciente) {
      tipo = 'paciente';
      token = item.tokenPaciente;
    }
    if (!token) {
      const e = new Error(`Este produto não possui bula ${tipo} disponível.`);
      e.status = 404;
      throw e;
    }
    const pdf = await fetchPdfB64(page, urlPdf(token));
    return { item, pdf, tipo };
  });
  const bula = await textoDeB64(capturado.pdf); // pdf-parse roda no Node, fora da página
  const apres = extrairApresentacao(bula.texto);
  const it = capturado.item;
  return {
    idProduto: it.idProduto,
    medicamento: it.nomeProduto,
    empresa: it.empresa,
    cnpj: it.cnpj,
    expediente: it.expediente,
    numeroRegistro: it.numeroRegistro,
    tipo: capturado.tipo, // 'profissional' | 'paciente' (o que realmente veio)
    concentracao: apres.concentracao, // autopreenchimento (best-effort)
    forma: apres.forma,
    ...bula,
  };
}

// Compat: só a bula do profissional (sem fallback), usada pela rota /bulario/bula-profissional.
async function bulaProfissionalPorNome(nome, opts = {}) {
  return bulaPorNome(nome, { ...opts, tipo: 'profissional' });
}

async function encerrar() {
  if (!browserPromise) return;
  try {
    const browser = await browserPromise;
    await browser.close();
  } catch {}
  browserPromise = null;
}

module.exports = { buscar, extrairTextoBula, bulaPorNome, bulaProfissionalPorNome, encerrar };
