'use strict';
/*
 * Copia dados de tabelas de CATÁLOGO do banco LOCAL (development) para PRODUÇÃO.
 * Mais simples/seguro que re-coletar em produção — o conteúdo independe de
 * ambiente (chaves lógicas próprias). Atualmente cobre:
 *   - web_bulas_cache          (chave única: expediente+tipo)
 *   - web_produtos_veterinarios(chave única: fonte+id_externo)
 *
 * - NÃO copia o `id` (deixa o autoincrement de produção), evitando colisão de PK;
 *   a idempotência vem do UNIQUE de cada tabela via ON DUPLICATE KEY UPDATE.
 * - Processa em lotes. Só LÊ do dev e ESCREVE no prod nessas tabelas.
 *
 * Uso:
 *   node scripts/sincronizarParaProducao.js                 # sincroniza AS DUAS
 *   node scripts/sincronizarParaProducao.js web_bulas_cache # só uma
 *   node scripts/sincronizarParaProducao.js --dry           # só conta, não grava
 *
 * Config: usa DEV_DB_* e PROD_DB_* do .env (mesmas do config/config.js).
 */
require('dotenv').config();
const { Sequelize, QueryTypes } = require('sequelize');
const cfg = require('../config/config');

const DRY = process.argv.includes('--dry');
const LOTE = Number(process.env.SYNC_LOTE || 100);

// Definição por tabela: colunas a copiar e chave única (para não atualizá-la).
const TABELAS = {
  web_bulas_cache: {
    cols: ['expediente', 'tipo', 'id_produto', 'nome_produto', 'empresa', 'cnpj',
      'numero_registro', 'texto', 'paginas', 'caracteres', 'tamanho_pdf_bytes',
      'createdAt', 'updatedAt'],
    chave: ['expediente', 'tipo'],
  },
  web_produtos_veterinarios: {
    cols: ['fonte', 'id_externo', 'nome', 'marca', 'especie', 'categoria', 'subcategoria',
      'principio_ativo', 'indicacao', 'apresentacao', 'via', 'porte', 'descricao', 'link',
      'st_ativo', 'createdAt', 'updatedAt'],
    chave: ['fonte', 'id_externo'],
  },
};

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const alvos = args.length ? args : Object.keys(TABELAS);

function conectar(c) {
  return new Sequelize(c.database, c.username, c.password, {
    host: c.host, port: c.port, dialect: 'mysql', logging: false, timezone: c.timezone,
  });
}

async function sincronizarTabela(dev, prod, tabela) {
  const def = TABELAS[tabela];
  if (!def) { console.log(`[sync] tabela desconhecida: ${tabela} (pulando)`); return; }
  const { cols, chave } = def;

  const [{ n: totalDev }] = await dev.query(`SELECT COUNT(*) n FROM ${tabela}`, { type: QueryTypes.SELECT });
  const [{ n: antesProd }] = await prod.query(`SELECT COUNT(*) n FROM ${tabela}`, { type: QueryTypes.SELECT });
  console.log(`\n[${tabela}] dev=${totalDev} | prod(antes)=${antesProd}${DRY ? ' | DRY-RUN' : ''}`);
  if (DRY || totalDev === 0) return;

  const placeholders = '(' + cols.map(() => '?').join(',') + ')';
  const updates = cols
    .filter((c) => !chave.includes(c) && c !== 'createdAt')
    .map((c) => `${c}=VALUES(${c})`).join(', ');

  let enviados = 0;
  for (let offset = 0; ; offset += LOTE) {
    const linhas = await dev.query(
      `SELECT ${cols.join(', ')} FROM ${tabela} ORDER BY id ASC LIMIT ? OFFSET ?`,
      { replacements: [LOTE, offset], type: QueryTypes.SELECT }
    );
    if (!linhas.length) break;
    const valores = [];
    const sqlValues = linhas.map((r) => { for (const c of cols) valores.push(r[c]); return placeholders; }).join(', ');
    await prod.query(
      `INSERT INTO ${tabela} (${cols.join(', ')}) VALUES ${sqlValues} ON DUPLICATE KEY UPDATE ${updates}`,
      { replacements: valores, type: QueryTypes.INSERT }
    );
    enviados += linhas.length;
    process.stdout.write(`\r[${tabela}] enviados ${enviados}/${totalDev} ...`);
  }
  process.stdout.write('\n');
  const [{ n: depoisProd }] = await prod.query(`SELECT COUNT(*) n FROM ${tabela}`, { type: QueryTypes.SELECT });
  console.log(`[${tabela}] concluído: prod(depois)=${depoisProd}`);
}

(async () => {
  const dev = conectar(cfg.development);
  const prod = conectar(cfg.production);
  try {
    await dev.authenticate();
    await prod.authenticate();
    console.log(`[sync] tabelas: ${alvos.join(', ')} | lote=${LOTE}`);
    for (const t of alvos) await sincronizarTabela(dev, prod, t);
    console.log('\n[sync] fim.');
  } catch (e) {
    console.error('\n[sync] ERRO:', e.message);
    process.exitCode = 1;
  } finally {
    await dev.close().catch(() => {});
    await prod.close().catch(() => {});
  }
})();
