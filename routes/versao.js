'use strict';

// GET /versao — identifica QUAL build do backend está no ar.
//
// Existe porque web e backend têm deploys SEPARADOS (repos diferentes, branches
// diferentes). Saber a versão do app web não diz nada sobre a API — e o caso de
// suporte mais comum aqui é justamente o backend estar defasado em relação ao
// frontend, o que faz uma tela nova falhar sem motivo aparente.
//
// PÚBLICO de propósito: precisa responder na tela de LOGIN, antes de haver sessão.
// Por isso devolve só o necessário para identificar o build — nada de env vars,
// caminhos ou configuração.
//
// ⚠️ Montar ANTES dos routers que fazem `route.use(requireAuth)` sem path
// (connect/cobrancas/assinatura), senão eles barram esta rota com 401.
const express = require('express');
const route = express.Router();

// A Vercel injeta estas em runtime nas funções serverless. Em dev elas não
// existem — daí o fallback, que também deixa claro na tela que é ambiente local.
const COMMIT = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7);
const BRANCH = process.env.VERCEL_GIT_COMMIT_REF || '';
const AMBIENTE = process.env.VERCEL_ENV || 'local';

route.get('/versao', (req, res) => {
  res.json({
    success: true,
    // string vazia quando roda fora da Vercel: o front mostra "local".
    commit: COMMIT,
    branch: BRANCH,
    ambiente: AMBIENTE,
    // ⚠️ NÃO existe "data do deploy" do backend: a Vercel não expõe timestamp de
    // deploy, e o início do processo aqui é o COLD START da função, que muda o
    // tempo todo e enganaria quem lesse como data de publicação. Por isso a
    // identificação do backend é pelo COMMIT, e a data na tela é a do build do web.
  });
});

module.exports = route;
