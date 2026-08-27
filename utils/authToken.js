'use strict';

// Emissão e verificação do JWT de sessão do WEB (veterinário e parceiro).
// O segredo vem de JWT_SECRET (obrigatório em produção). O "sub" carrega o id
// e o "tipo" diz de QUAL tabela esse id é — é a única fonte de identidade
// confiável do backend.
//
// 🔴 POR QUE O `tipo` EXISTE (não remover):
// `web_veterinarios` e `web_parceiros` são tabelas DIFERENTES com ids que se
// sobrepõem: existe o veterinário 3 e existe o parceiro 3. Um token que
// carregasse só `sub` não distinguiria os dois, e o parceiro 3 entraria nas
// rotas do veterinário 3 — prontuários, cobranças e pacientes de outra pessoa.
// Foi por isso que `signAuthToken` passou a exigir o tipo em vez de assinar
// qualquer id que chegasse.
//
// ⚠️ COMPATIBILIDADE: tokens emitidos ANTES desta mudança não têm `tipo`, e
// valem 7 dias. Todos eles eram de veterinário (o parceiro nunca teve token de
// verdade — ver o histórico em routes/parceiros/paceiros.js), então a ausência
// de `tipo` é lida como 'veterinario'. Depois de 7 dias da publicação isso
// deixa de acontecer sozinho; o default pode virar erro a partir daí.

const jwt = require('jsonwebtoken');

const EXPIRACAO = '7d';

const TIPO_VETERINARIO = 'veterinario';
const TIPO_PARCEIRO = 'parceiro';
const TIPOS = [TIPO_VETERINARIO, TIPO_PARCEIRO];

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET não configurado no ambiente');
  }
  return secret;
}

/**
 * Assina um token de sessão.
 *
 * @param {number|string} id  id na tabela do respectivo tipo
 * @param {'veterinario'|'parceiro'} tipo
 *
 * ⚠️ O `tipo` é obrigatório de propósito. Com default silencioso, um `sign`
 * novo em qualquer rota nasceria como veterinário sem que ninguém notasse —
 * que é exatamente o erro que esta função existe para tornar impossível.
 */
function signAuthToken(id, tipo) {
  if (!TIPOS.includes(tipo)) {
    throw new Error(
      `signAuthToken: tipo inválido (${tipo}). Use '${TIPO_VETERINARIO}' ou '${TIPO_PARCEIRO}'.`,
    );
  }
  return jwt.sign({ sub: String(id), tipo }, getSecret(), { expiresIn: EXPIRACAO });
}

/**
 * Verifica o token e devolve `{ id, tipo }`, ou lança.
 *
 * ⚠️ Devolve OBJETO, não número. Antes devolvia o id cru, e quem chamasse
 * ganharia o id de um parceiro achando que era de veterinário. Forçar o
 * chamador a olhar o `tipo` é o ponto.
 */
function verifyAuthToken(token) {
  const payload = jwt.verify(token, getSecret());
  const id = Number(payload.sub);
  if (!id || Number.isNaN(id)) {
    throw new Error('Token sem sub válido');
  }
  // Token antigo (sem `tipo`) só pode ser de veterinário — ver o aviso de
  // compatibilidade no topo do arquivo.
  const tipo = payload.tipo || TIPO_VETERINARIO;
  if (!TIPOS.includes(tipo)) {
    throw new Error('Token com tipo desconhecido');
  }
  return { id, tipo };
}

module.exports = {
  signAuthToken,
  verifyAuthToken,
  TIPO_VETERINARIO,
  TIPO_PARCEIRO,
};
