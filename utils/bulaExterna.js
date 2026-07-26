'use strict';
/*
 * Fonte de bula GRATUITA de terceiros (Fase 2 do enriquecimento), para os
 * produtos que a ANVISA não tem bula (nem do profissional, nem do paciente).
 *
 * Fonte: consultaremedios.com.br — o conteúdo da bula é HTML ESTÁTICO (não
 * depende de JS) e o site NÃO fica atrás de Cloudflare (responde a fetch de
 * servidor, de qualquer IP). Por isso, ao contrário do crawler da ANVISA, esta
 * fonte roda com um simples https.get, sem Chrome, e pode rodar na Vercel/cron.
 *
 * Estratégia de casamento nome→página: as bulas ficam em `/<slug>/bula`. Tenta
 * o slug do nome (e variações mais curtas), SEGUINDO redirects 301 do próprio
 * site (ex.: /ranitidina/bula → /ranitidina-lfm/bula). A página de busca (/b/..)
 * é renderizada por JS e não serve para extrair links por fetch simples.
 *
 * Uso:
 *   const { bulaExternaPorNome } = require('./utils/bulaExterna');
 *   const r = await bulaExternaPorNome('cloridrato de ranitidina');
 *   // r = { medicamento, url, expediente, tipo:'externo', texto, caracteres, secoes }
 */
const https = require('https');
const { URL } = require('url');

const BASE = 'https://consultaremedios.com.br';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Seções úteis para o cadastro do medicamento, na ordem em que serão montadas.
// Propositalmente PULAMOS "acao-da-substancia" (farmacologia/eficácia, ~80k) e
// "doencas-relacionadas" (links), que não servem para o cadastro clínico.
const SECOES = [
  ['para-que-serve', 'INDICAÇÕES (para que serve)'],
  ['contraindicacao', 'CONTRAINDICAÇÕES'],
  ['posologia-como-usar', 'COMO USAR / POSOLOGIA'],
  ['superdose', 'SUPERDOSE'],
  ['precaucoes', 'PRECAUÇÕES / ADVERTÊNCIAS'],
  ['reacoes-adversas', 'REAÇÕES ADVERSAS'],
  ['interacao-medicamentosa', 'INTERAÇÕES MEDICAMENTOSAS'],
];
const MAX_SECAO = 6000;   // corta cada seção (posologia pode ser enorme)
const MAX_TOTAL = 40000;  // teto do texto gravado

function slugify(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .replace(/%/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

// Palavras de "ruído" comuns em nomes de produto que atrapalham o slug direto.
const RUIDO = new Set([
  'comprimido', 'comprimidos', 'revestido', 'solucao', 'oral', 'injetavel',
  'gotas', 'xarope', 'suspensao', 'pomada', 'creme', 'gel', 'capsula',
  'capsulas', 'mg', 'ml', 'g', 'de', 'da', 'do', 'com', 'sem', 'e',
]);

// Gera variações de slug, do mais específico para o mais genérico.
function variacoesSlug(nome) {
  const base = slugify(nome);
  const tokens = base.split('-').filter(Boolean);
  const uteis = tokens.filter((t) => !RUIDO.has(t) && !/^\d+$/.test(t));
  const vars = new Set();
  if (base) vars.add(base);
  if (uteis.length && uteis.join('-') !== base) vars.add(uteis.join('-'));
  if (uteis.length >= 2) vars.add(uteis.slice(0, 2).join('-'));
  if (uteis.length) vars.add(uteis[0]); // só o princípio ativo / 1ª palavra
  return [...vars].filter((s) => s && s.length >= 3);
}

// GET seguindo redirects (só no mesmo host), devolvendo corpo + URL final.
function get(url, maxRedir = 5) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } }, (r) => {
      const { statusCode, headers } = r;
      if ([301, 302, 303, 307, 308].includes(statusCode) && headers.location && maxRedir > 0) {
        r.resume(); // descarta corpo
        const prox = new URL(headers.location, url).toString();
        // segue só dentro do domínio consultaremedios
        if (!/consultaremedios\.com\.br/.test(prox)) return resolve({ status: statusCode, body: '', url });
        return resolve(get(prox, maxRedir - 1));
      }
      let b = '';
      r.setEncoding('utf8');
      r.on('data', (d) => (b += d));
      r.on('end', () => resolve({ status: statusCode, body: b, url }));
    });
    req.on('error', (e) => resolve({ status: 0, body: '', url, erro: e.message }));
    req.setTimeout(20000, () => { req.destroy(); resolve({ status: 0, body: '', url, erro: 'timeout' }); });
  });
}

function limpaHtml(frag) {
  return String(frag || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .trim();
}

// Extrai o texto de cada seção fatiando o HTML entre os divs .leaflet-section.
// Usa os PRÓPRIOS divs de seção como fronteiras ordenadas (robusto a ocorrências
// do id no menu/carrossel, que não têm a classe leaflet-section).
function extrairSecoes(html) {
  const re = /<div[^>]*\bid="([a-z-]+)"[^>]*class="[^"]*leaflet-section/g;
  const marcos = [];
  let m;
  while ((m = re.exec(html))) marcos.push({ id: m[1], pos: m.index });
  const querido = new Set(SECOES.map(([id]) => id));
  const out = {};
  for (let i = 0; i < marcos.length; i++) {
    const { id, pos } = marcos[i];
    if (!querido.has(id)) continue;
    const fim = i + 1 < marcos.length ? marcos[i + 1].pos : html.length;
    const abre = html.indexOf('>', pos); // pula o resto da tag de abertura
    const txt = limpaHtml(html.slice(abre + 1, fim));
    if (txt) out[id] = txt.slice(0, MAX_SECAO);
  }
  return out;
}

function montarTexto(secoes) {
  let txt = '';
  for (const [id, rotulo] of SECOES) {
    if (!secoes[id]) continue;
    const bloco = `\n### ${rotulo}\n${secoes[id]}\n`;
    if (txt.length + bloco.length > MAX_TOTAL) break;
    txt += bloco;
  }
  return txt.trim();
}

async function bulaExternaPorNome(nome) {
  if (!nome || !String(nome).trim()) throw new Error('nome é obrigatório');
  const variantes = variacoesSlug(nome);
  const tentadas = new Set();
  for (const slug of variantes) {
    if (tentadas.has(slug)) continue;
    tentadas.add(slug);
    const r = await get(`${BASE}/${slug}/bula`);
    if (r.status === 200 && /leaflet-section/.test(r.body)) {
      const secoes = extrairSecoes(r.body);
      const texto = montarTexto(secoes);
      // exige ao menos a indicação OU a posologia para valer como bula útil
      if (texto && (secoes['para-que-serve'] || secoes['posologia-como-usar'])) {
        const slugFinal = (r.url.match(/\/([a-z0-9-]+)\/bula/) || [])[1] || slug;
        return {
          idProduto: null,
          medicamento: nome,
          empresa: null,
          cnpj: null,
          numeroRegistro: null,
          expediente: slugFinal.slice(0, 50), // chave estável no cache (com tipo 'externo')
          tipo: 'externo',
          texto,
          caracteres: texto.length,
          paginas: null,
          tamanhoPdfBytes: null,
          url: r.url,
          secoes: Object.keys(secoes),
        };
      }
    }
  }
  const e = new Error('Nenhuma bula encontrada em consultaremedios para: ' + nome);
  e.status = 404;
  throw e;
}

module.exports = { bulaExternaPorNome, slugify, variacoesSlug, extrairSecoes };
