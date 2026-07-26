'use strict';
/*
 * Importa o catálogo de PRODUTOS VETERINÁRIOS para web_produtos_veterinarios a
 * partir da API pública de catálogo (VTEX) de um e-commerce pet (Cobasi).
 *
 * Por quê: o MAPA/PUBLIVET não expõe CSV aberto (só painel Qlik, não raspável por
 * servidor). Esta base cobre nome/marca/espécie/princípio ativo (Composição)/
 * indicação/apresentação/via — sem nº de registro oficial. Roda com https simples
 * (sem Chrome), respeitando paginação e com throttle.
 *
 * Uso:
 *   node scripts/importarProdutosVeterinarios.js
 *   NODE_ENV=production node scripts/importarProdutosVeterinarios.js
 *
 * Config (env, opcionais):
 *   PVET_ESPECIES=cachorro,gato,...  categorias de espécie a varrer (medicamentos)
 *   PVET_DELAY_MS=400                pausa entre requisições
 *   PVET_LIMITE=0                    limite de produtos (0 = todos)
 *
 * ⚠️ Fonte de terceiros: dado público de catálogo, uso interno como referência
 * clínica. Rodar em ritmo educado (throttle). Reexecutar periodicamente atualiza.
 */
require('dotenv').config();
const https = require('https');
const models = require('../models');
const { WebProdutosVeterinarios, sequelize } = models;

const BASE = 'https://www.cobasi.com.br';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const ESPECIES = (process.env.PVET_ESPECIES ||
  'cachorro,gato,passaros,aves,bovinos,cavalo,roedores,repteis').split(',').map((s) => s.trim()).filter(Boolean);
const DELAY_MS = Number(process.env.PVET_DELAY_MS || 400);
const LIMITE = Number(process.env.PVET_LIMITE || 0);
const PAGINA = 50; // janela máxima da API VTEX

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJson(path) {
  return new Promise((resolve) => {
    const r = https.get(BASE + path, { headers: { 'User-Agent': UA, Accept: 'application/json' } }, (resp) => {
      let b = '';
      resp.setEncoding('utf8');
      resp.on('data', (d) => (b += d));
      resp.on('end', () => {
        let json = null;
        try { json = JSON.parse(b); } catch {}
        resolve({ status: resp.statusCode, json, total: resp.headers.resources });
      });
    });
    r.on('error', (e) => resolve({ status: 0, erro: e.message }));
    r.setTimeout(25000, () => { r.destroy(); resolve({ status: 0, erro: 'timeout' }); });
  });
}

const limpa = (s) => String(s == null ? '' : s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
const spec = (p, nome) => Array.isArray(p[nome]) ? p[nome].join(', ') : (p[nome] || '');
const corta = (s, n) => (s && s.length > n ? s.slice(0, n) : s) || null;

// Extrai espécie/categoria/subcategoria do array de categorias do produto.
function classificar(p) {
  const cats = p.categories || [];
  const med = cats.find((c) => /\/Medicamentos\//i.test(c)) || cats.find((c) => /\/Medicamentos/i.test(c)) || cats[0] || '';
  const parts = med.split('/').filter(Boolean); // ['Cachorro','Medicamentos','Vermífugo']
  return { especie: parts[0] || null, categoria: parts[1] || null, subcategoria: parts[2] || null };
}

function mapear(p) {
  const cls = classificar(p);
  return {
    fonte: 'cobasi',
    id_externo: String(p.productId),
    nome: corta(limpa(p.productName), 255),
    marca: corta(limpa(p.brand), 120),
    especie: corta(cls.especie, 60),
    categoria: corta(cls.categoria, 120),
    subcategoria: corta(cls.subcategoria, 120),
    principio_ativo: corta(limpa(spec(p, 'Composição')), 500),
    indicacao: limpa(spec(p, 'Indicação')) || null,
    apresentacao: corta(limpa(spec(p, 'Apresentação')), 255),
    via: corta(limpa(spec(p, 'Modo de Aplicação')), 80),
    porte: corta(limpa(spec(p, 'Porte')), 120),
    descricao: (limpa(p.description) || '').slice(0, 60000) || null,
    link: corta(p.linkText ? `${BASE}/${p.linkText}/p` : null, 255),
    st_ativo: 1,
  };
}

(async () => {
  console.log(`[prod-vet] fonte=cobasi(VTEX) espécies=${ESPECIES.join(',')} delay=${DELAY_MS}ms${LIMITE ? ` limite=${LIMITE}` : ''}`);
  const vistos = new Set(); // dedup por productId entre espécies
  let gravados = 0;
  let processados = 0;

  try {
    for (const esp of ESPECIES) {
      if (LIMITE && processados >= LIMITE) break;
      // total da categoria
      const head = await getJson(`/api/catalog_system/pub/products/search/${esp}/medicamentos?_from=0&_to=0`);
      const total = head.total ? Number((head.total.split('/')[1] || '0')) : 0;
      if (!total) { console.log(`  ${esp}: 0`); continue; }
      console.log(`  ${esp}: ${total} produtos`);

      for (let from = 0; from < total; from += PAGINA) {
        if (LIMITE && processados >= LIMITE) break;
        const to = Math.min(from + PAGINA - 1, total - 1);
        const r = await getJson(`/api/catalog_system/pub/products/search/${esp}/medicamentos?_from=${from}&_to=${to}`);
        if (r.status !== 200 && r.status !== 206) { console.log(`    (falha ${from}-${to}: ${r.status} ${r.erro || ''})`); await sleep(DELAY_MS); continue; }
        for (const p of (r.json || [])) {
          if (LIMITE && processados >= LIMITE) break;
          const pid = String(p.productId);
          if (vistos.has(pid)) continue;
          vistos.add(pid);
          try {
            await WebProdutosVeterinarios.upsert(mapear(p));
            gravados++;
          } catch (e) {
            console.log(`    (erro upsert ${pid}: ${e.message.slice(0, 60)})`);
          }
          processados++;
        }
        process.stdout.write(`\r    ${esp}: ${Math.min(to + 1, total)}/${total} | distintos gravados=${gravados}   `);
        await sleep(DELAY_MS);
      }
      process.stdout.write('\n');
    }
  } finally {
    await sequelize.close().catch(() => {});
  }

  console.log(`\n[prod-vet] fim: distintos=${vistos.size} gravados/atualizados=${gravados}`);
})().catch((e) => {
  console.error('\n[prod-vet] ERRO FATAL:', e && e.message);
  process.exit(1);
});
