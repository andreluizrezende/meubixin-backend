'use strict';
/*
 * Enriquecimento INCREMENTAL do cache de bulas (web_bulas_cache) a partir do
 * catálogo local web_anvisa_medicamentos, usando o crawler (utils/anvisaBulario).
 *
 * Por que incremental: varrer os ~20 mil nomes distintos de uma vez leva DIAS de
 * Chrome headful e o Cloudflare bloqueia mineração em massa. Este script processa
 * um LOTE por execução, com THROTTLE, e RETOMA de onde parou (cursor por id salvo
 * em disco) — pensado para rodar algumas centenas por dia (ex.: via cron/pm2).
 *
 * ⚠️ Precisa de IP residencial + Chrome (headful por padrão; o Cloudflare barra
 * headless e datacenter). Rode no terminal do usuário, não em servidor de nuvem.
 *
 * Uso:
 *   node scripts/enriquecerBulasAnvisa.js
 *   NODE_ENV=production node scripts/enriquecerBulasAnvisa.js   # cache de produção
 *
 * Config (env, todos opcionais):
 *   ANVISA_ENRIQUECER_LIMITE=200    quantos NOMES coletar (com sucesso ou não) por execução
 *   ANVISA_ENRIQUECER_LOTE=200      tamanho do lote lido do banco por vez
 *   ANVISA_ENRIQUECER_DELAY_MS=4000 pausa extra entre itens (além das pausas do crawler)
 *   ANVISA_ENRIQUECER_SO_ATIVOS=1   só produtos com situacao_registro='Ativo' (padrão: 1)
 *   ANVISA_ENRIQUECER_RESET=1       zera o cursor e recomeça do primeiro produto
 *   ANVISA_ENRIQUECER_REVISAR=1     NÃO varre o catálogo; reprocessa os nomes já
 *                                   marcados "sem bula" tentando a bula do PACIENTE
 *                                   (fallback ANVISA, via Chrome). Recuperados saem
 *                                   da lista semBula. (Fase 1)
 *   ANVISA_ENRIQUECER_SITE=1        NÃO varre o catálogo; reprocessa os "sem bula"
 *                                   numa fonte GRATUITA de terceiros
 *                                   (consultaremedios). NÃO usa Chrome (https
 *                                   simples), roda em qualquer IP. tipo='externo'.
 *                                   (Fase 2 — sugestão: ANVISA_ENRIQUECER_DELAY_MS=800)
 *   ANVISA_HEADLESS=1               (do crawler) headless — só depois do perfil já ter passado
 *
 * Ordem sugerida p/ os "sem bula": (1) REVISAR (paciente, ANVISA) → (2) SITE
 * (consultaremedios) no que sobrar. Fonte da varredura normal: tenta PROFISSIONAL
 * e, se não houver, cai p/ PACIENTE. O `tipo` coletado (profissional/paciente/
 * externo) é gravado em web_bulas_cache.tipo.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const models = require('../models');
const { WebAnvisaMedicamentos, WebBulasCache, sequelize } = models;
const anvisa = require('../utils/anvisaBulario');
const { bulaExternaPorNome } = require('../utils/bulaExterna');

const LIMITE = Number(process.env.ANVISA_ENRIQUECER_LIMITE || 200);
const LOTE = Number(process.env.ANVISA_ENRIQUECER_LOTE || 200);
const DELAY_MS = Number(process.env.ANVISA_ENRIQUECER_DELAY_MS || 4000);
const SO_ATIVOS = process.env.ANVISA_ENRIQUECER_SO_ATIVOS !== '0';
const RESET = process.env.ANVISA_ENRIQUECER_RESET === '1';
// Modo revisão (ANVISA): reprocessa os nomes já marcados "sem bula" tentando a
// bula do PACIENTE (fallback). Recuperados saem da lista semBula.
const REVISAR = process.env.ANVISA_ENRIQUECER_REVISAR === '1';
// Modo site (Fase 2): reprocessa os "sem bula" numa fonte GRATUITA de terceiros
// (consultaremedios). NÃO usa Chrome (https simples), roda em qualquer IP.
const SITE = process.env.ANVISA_ENRIQUECER_SITE === '1';
const REVISAO = REVISAR || SITE; // ambos iteram a lista semBula

// Cursor + nomes "sem bula" persistidos por ambiente (dev/prod não se misturam).
const AMBIENTE = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
const ESTADO_PATH = path.join(__dirname, '..', `.anvisa-enriquecimento-${AMBIENTE}.json`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function lerEstado() {
  if (RESET) return { cursor: 0, semBula: [] };
  try {
    const j = JSON.parse(fs.readFileSync(ESTADO_PATH, 'utf8'));
    return { cursor: Number(j.cursor) || 0, semBula: Array.isArray(j.semBula) ? j.semBula : [] };
  } catch {
    return { cursor: 0, semBula: [] };
  }
}
function salvarEstado(estado) {
  try {
    fs.writeFileSync(
      ESTADO_PATH,
      JSON.stringify({ cursor: estado.cursor, semBula: estado.semBula.slice(-5000) }, null, 0)
    );
  } catch (e) {
    console.warn('  (aviso) não consegui salvar o estado:', e.message);
  }
}

// Grava/atualiza o cache (mesma forma do gravarCache da rota do bulário).
// Usa o `tipo` que realmente veio (profissional ou paciente, via fallback).
async function gravarCache(resultado) {
  if (!resultado || !resultado.expediente || !resultado.texto) return false;
  await WebBulasCache.upsert({
    expediente: String(resultado.expediente),
    tipo: resultado.tipo || 'profissional',
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
  return true;
}

// Já temos QUALQUER bula (profissional OU paciente) desse nome no cache?
async function jaTemNoCache(nome) {
  const row = await WebBulasCache.findOne({
    where: { nome_produto: nome },
    attributes: ['id'],
  });
  return !!row;
}

// Nomes que nunca vão casar numa busca — lixo de dados / não-medicamentos óbvios.
// Na revisão, descartamos esses da lista "sem bula" (não vale gastar Chrome com eles).
function ehNomeUtil(nome) {
  const n = String(nome || '').trim();
  if (n.length < 3) return false;
  if (/&#\d+;|&[a-z]+;/i.test(n)) return false;                // entidades HTML no nome
  if (/n[?]o\s+declarad|n[aã]o\s+declarad/i.test(n)) return false; // "não declarado"
  return true;
}

// Processa UM nome. Fonte:
//   SITE=true  → fonte gratuita de terceiros (consultaremedios, sem Chrome);
//   SITE=false → ANVISA (profissional, com fallback p/ paciente, via Chrome).
// Retorna 'gravado' | 'sembula' | 'erro'.
async function processarNome(nome) {
  try {
    const resultado = SITE
      ? await bulaExternaPorNome(nome)
      : await anvisa.bulaPorNome(nome, { fallbackPaciente: true });
    const ok = await gravarCache(resultado);
    if (ok) { process.stdout.write(`✓ gravado (${resultado.tipo})`); return 'gravado'; }
    process.stdout.write('· sem texto');
    return 'sembula';
  } catch (err) {
    if (err && err.status === 404) { process.stdout.write('· sem bula'); return 'sembula'; }
    process.stdout.write('✗ ' + (err && err.message ? err.message.slice(0, 50) : 'erro'));
    return 'erro';
  }
}

(async () => {
  const estado = lerEstado();
  const semBula = new Set(estado.semBula.map((n) => n.toLowerCase()));
  const feitosNaSessao = new Set(); // dedup de nomes DENTRO desta execução

  const modoTxt = SITE ? 'REVISÃO(sem-bula→site)' : REVISAR ? 'REVISÃO(sem-bula→paciente)' : 'catálogo';
  console.log(
    `[enriquecer] ambiente=${AMBIENTE} modo=${modoTxt} ` +
      `cursor=${estado.cursor} limite=${LIMITE} soAtivos=${SO_ATIVOS}`
  );

  let coletados = 0; // nomes processados nesta execução (sucesso OU sem bula)
  let gravados = 0;
  let pulados = 0;
  let erros = 0;
  let recuperados = 0; // (revisão) nomes que saíram de "sem bula" por terem bula do paciente
  let ultimoId = estado.cursor;

  try {
    if (REVISAO) {
      // Reprocessa os nomes já marcados "sem bula" (via ANVISA paciente ou via site).
      const alvos = [...semBula];
      console.log(`[enriquecer] ${alvos.length} nomes "sem bula" para revisar.`);
      for (const chave of alvos) {
        if (coletados >= LIMITE) break;
        if (feitosNaSessao.has(chave)) continue;
        feitosNaSessao.add(chave);

        if (!ehNomeUtil(chave)) { pulados++; semBula.delete(chave); continue; } // lixo: descarta
        if (await jaTemNoCache(chave)) { pulados++; semBula.delete(chave); continue; } // já recuperado

        process.stdout.write(`\r[${coletados + 1}/${LIMITE}] "${chave.slice(0, 40)}" ... `);
        const r = await processarNome(chave);
        if (r === 'gravado') { gravados++; recuperados++; semBula.delete(chave); }
        else if (r === 'erro') erros++;
        // 'sembula' → continua sem bula (permanece na lista)
        coletados++;
        salvarEstado({ cursor: ultimoId, semBula: [...semBula] });
        process.stdout.write('\n');
        await sleep(DELAY_MS);
      }
    } else {
      while (coletados < LIMITE) {
        const where = { id: { [Op.gt]: ultimoId } };
        if (SO_ATIVOS) where.situacao_registro = 'Ativo';
        const linhas = await WebAnvisaMedicamentos.findAll({
          where,
          order: [['id', 'ASC']],
          limit: LOTE,
          attributes: ['id', 'nome_produto'],
        });
        if (!linhas.length) {
          console.log('\n[enriquecer] fim do catálogo — nada mais a processar.');
          break;
        }

        for (const linha of linhas) {
          if (coletados >= LIMITE) break;
          ultimoId = linha.id;
          const nome = (linha.nome_produto || '').trim();
          const chave = nome.toLowerCase();
          if (!nome || feitosNaSessao.has(chave)) continue; // vazio ou duplicado nesta sessão
          feitosNaSessao.add(chave);

          if (semBula.has(chave)) { pulados++; continue; }        // já sabemos que não tem bula
          if (await jaTemNoCache(nome)) { pulados++; continue; }   // já está no cache

          process.stdout.write(`\r[${coletados + 1}/${LIMITE}] id=${linha.id} "${nome.slice(0, 40)}" ... `);
          const r = await processarNome(nome);
          if (r === 'gravado') gravados++;
          else if (r === 'sembula') semBula.add(chave); // marca pra não repetir
          else erros++;
          coletados++;
          // salva progresso a cada item (retoma exatamente daqui se interromper)
          salvarEstado({ cursor: ultimoId, semBula: [...semBula] });
          process.stdout.write('\n');
          await sleep(DELAY_MS);
        }
      }
    }
  } finally {
    salvarEstado({ cursor: ultimoId, semBula: [...semBula] });
    await anvisa.encerrar().catch(() => {});
    await sequelize.close().catch(() => {});
  }

  console.log(
    `\n[enriquecer] fim da execução: processados=${coletados} gravados=${gravados}` +
      (REVISAO ? ` recuperados=${recuperados} restam-sem-bula=${semBula.size}` : ` cursor=${ultimoId}`) +
      ` pulados=${pulados} erros=${erros}`
  );
  console.log(
    REVISAO
      ? `[enriquecer] rode de novo (mesmo modo) para revisar mais dos ${semBula.size} restantes.`
      : `[enriquecer] rode de novo para continuar do id ${ultimoId}.`
  );
})().catch((e) => {
  console.error('\n[enriquecer] ERRO FATAL:', e && e.message);
  process.exit(1);
});
