'use strict';
/*
 * Importa o catálogo de medicamentos dos DADOS ABERTOS da ANVISA
 * (dados.anvisa.gov.br — fora do Cloudflare) para a tabela anvisa_medicamentos.
 *
 * Roda de qualquer lugar (não precisa de Chrome/navegador). Faz refresh completo
 * (trunca e reinsere). Rode periodicamente (ex.: cron semanal).
 *
 * Uso:  node scripts/importarMedicamentosAnvisa.js
 *       (produção)  NODE_ENV=production node scripts/importarMedicamentosAnvisa.js
 */
require('dotenv').config();
const https = require('https');
const models = require('../models');
const { WebAnvisaMedicamentos, sequelize } = models;

// A ANVISA serve uma cadeia de certificado incompleta (UNABLE_TO_VERIFY_LEAF_
// SIGNATURE). Baixamos via https com rejectUnauthorized:false SÓ para este
// download (não afeta a conexão com o banco). Segue redirects.
function baixar(url, redir = 0) {
  return new Promise((resolve, reject) => {
    if (redir > 5) return reject(new Error('redirects demais'));
    const req = https.get(
      url,
      { headers: { 'User-Agent': UA }, agent: new https.Agent({ rejectUnauthorized: false }) },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return baixar(new URL(res.headers.location, url).toString(), redir + 1).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error('HTTP ' + res.statusCode));
        }
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    req.setTimeout(120000, () => req.destroy(new Error('timeout no download')));
  });
}

const URL_CSV = 'https://dados.anvisa.gov.br/dados/DADOS_ABERTOS_MEDICAMENTOS.csv';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Parser de uma linha CSV (delimitador ';', aspas ", aspas duplas escapadas "").
function parseLinha(linha) {
  const out = [];
  let cur = '';
  let dentroAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (dentroAspas) {
      if (ch === '"') {
        if (linha[i + 1] === '"') { cur += '"'; i++; }
        else dentroAspas = false;
      } else cur += ch;
    } else if (ch === '"') {
      dentroAspas = true;
    } else if (ch === ';') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

(async () => {
  console.log('Baixando CSV da ANVISA...');
  const buf = await baixar(URL_CSV);
  const texto = buf.toString('latin1'); // o arquivo é ISO-8859-1
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim().length);
  console.log('Linhas no arquivo:', linhas.length);

  const header = parseLinha(linhas[0]).map((h) => h.trim());
  const idx = (n) => header.indexOf(n);
  const iTipo = idx('TIPO_PRODUTO');
  const iNome = idx('NOME_PRODUTO');
  const iCat = idx('CATEGORIA_REGULATORIA');
  const iReg = idx('NUMERO_REGISTRO_PRODUTO');
  const iProc = idx('NUMERO_PROCESSO');
  const iClasse = idx('CLASSE_TERAPEUTICA');
  const iEmp = idx('EMPRESA_DETENTORA_REGISTRO');
  const iSit = idx('SITUACAO_REGISTRO');
  const iPA = idx('PRINCIPIO_ATIVO');
  if (iNome < 0) throw new Error('Cabeçalho inesperado: NOME_PRODUTO não encontrado');

  const corta = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);
  const registros = [];
  for (let i = 1; i < linhas.length; i++) {
    const c = parseLinha(linhas[i]);
    const nome = c[iNome] && c[iNome].trim();
    if (!nome) continue;
    registros.push({
      nome_produto: corta(nome, 255),
      principio_ativo: corta(c[iPA], 500),
      numero_registro: corta(c[iReg], 50),
      empresa: corta(c[iEmp], 255),
      categoria_regulatoria: corta(c[iCat], 120),
      classe_terapeutica: corta(c[iClasse], 255),
      situacao_registro: corta(c[iSit], 60),
      numero_processo: corta(c[iProc], 50),
      tipo_produto: corta(c[iTipo], 60),
    });
  }
  console.log('Registros a importar:', registros.length);

  const LOTE = 1000;
  await sequelize.transaction(async (t) => {
    await WebAnvisaMedicamentos.destroy({ where: {}, truncate: true, transaction: t });
    for (let i = 0; i < registros.length; i += LOTE) {
      await WebAnvisaMedicamentos.bulkCreate(registros.slice(i, i + LOTE), { transaction: t, logging: false });
      process.stdout.write(`\r  inseridos ${Math.min(i + LOTE, registros.length)}/${registros.length}`);
    }
  });
  console.log(`\n✅ Importados ${registros.length} medicamentos em anvisa_medicamentos.`);
  await sequelize.close();
})().catch((e) => { console.error('\nERRO:', e.message); process.exit(1); });
