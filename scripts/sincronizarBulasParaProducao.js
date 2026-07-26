'use strict';
/*
 * Copia o cache de bulas (web_bulas_cache) do banco LOCAL (development) para o de
 * PRODUÇÃO. Mais simples e seguro do que enriquecer direto em produção — o
 * conteúdo da bula independe de ambiente (chave lógica: expediente+tipo).
 *
 * - NÃO copia o `id` (deixa o autoincrement de produção cuidar), evitando colisão
 *   de PK; a idempotência vem do UNIQUE (expediente, tipo) via ON DUPLICATE KEY.
 * - Processa em lotes (texto de bula é grande).
 * - Só LÊ do dev e ESCREVE no prod nesta tabela; não toca em mais nada.
 *
 * Uso:
 *   node scripts/sincronizarBulasParaProducao.js            # sincroniza de fato
 *   node scripts/sincronizarBulasParaProducao.js --dry      # só conta, não grava
 *
 * Config: usa DEV_DB_* e PROD_DB_* do .env (mesmas do config/config.js).
 */
require('dotenv').config();
const { Sequelize, QueryTypes } = require('sequelize');
const cfg = require('../config/config');

const DRY = process.argv.includes('--dry');
const LOTE = Number(process.env.SYNC_LOTE || 100);

const COLS = [
  'expediente', 'tipo', 'id_produto', 'nome_produto', 'empresa', 'cnpj',
  'numero_registro', 'texto', 'paginas', 'caracteres', 'tamanho_pdf_bytes',
  'createdAt', 'updatedAt',
];

function conectar(c, nome) {
  return new Sequelize(c.database, c.username, c.password, {
    host: c.host, port: c.port, dialect: 'mysql', logging: false,
    timezone: c.timezone, dialectOptions: {},
  });
}

(async () => {
  const dev = conectar(cfg.development, 'dev');
  const prod = conectar(cfg.production, 'prod');
  try {
    await dev.authenticate();
    await prod.authenticate();

    const [{ n: totalDev }] = await dev.query('SELECT COUNT(*) n FROM web_bulas_cache', { type: QueryTypes.SELECT });
    const [{ n: antesProd }] = await prod.query('SELECT COUNT(*) n FROM web_bulas_cache', { type: QueryTypes.SELECT });
    console.log(`[sync] dev=${totalDev} linhas | prod(antes)=${antesProd} linhas | lote=${LOTE}${DRY ? ' | DRY-RUN' : ''}`);
    if (DRY) { await dev.close(); await prod.close(); return; }

    const placeholdersLinha = '(' + COLS.map(() => '?').join(',') + ')';
    // No conflito de (expediente,tipo), atualiza o conteúdo (bula republicada).
    const updates = COLS.filter((c) => c !== 'expediente' && c !== 'tipo' && c !== 'createdAt')
      .map((c) => `${c}=VALUES(${c})`).join(', ');

    let enviados = 0;
    let offset = 0;
    for (;;) {
      const linhas = await dev.query(
        `SELECT ${COLS.join(', ')} FROM web_bulas_cache ORDER BY id ASC LIMIT ? OFFSET ?`,
        { replacements: [LOTE, offset], type: QueryTypes.SELECT }
      );
      if (!linhas.length) break;
      const valores = [];
      const sqlValues = linhas.map((r) => {
        for (const c of COLS) valores.push(r[c]);
        return placeholdersLinha;
      }).join(', ');
      await prod.query(
        `INSERT INTO web_bulas_cache (${COLS.join(', ')}) VALUES ${sqlValues} ` +
          `ON DUPLICATE KEY UPDATE ${updates}`,
        { replacements: valores, type: QueryTypes.INSERT }
      );
      enviados += linhas.length;
      offset += LOTE;
      process.stdout.write(`\r[sync] enviados ${enviados}/${totalDev} ...`);
    }
    process.stdout.write('\n');

    const [{ n: depoisProd }] = await prod.query('SELECT COUNT(*) n FROM web_bulas_cache', { type: QueryTypes.SELECT });
    const porTipo = await prod.query('SELECT tipo, COUNT(*) n FROM web_bulas_cache GROUP BY tipo', { type: QueryTypes.SELECT });
    console.log(`[sync] concluído: prod(depois)=${depoisProd} | por tipo: ${JSON.stringify(porTipo)}`);
  } catch (e) {
    console.error('\n[sync] ERRO:', e.message);
    process.exitCode = 1;
  } finally {
    await dev.close().catch(() => {});
    await prod.close().catch(() => {});
  }
})();
