'use strict';

// Emissão e verificação do JWT de sessão do veterinário web.
// O segredo vem de JWT_SECRET (obrigatório em produção). O "sub" carrega o id
// do veterinário — é a única fonte de identidade confiável do backend.

const jwt = require('jsonwebtoken');

const EXPIRACAO = '7d';

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET não configurado no ambiente');
  }
  return secret;
}

// Assina um token para o veterinário informado.
function signAuthToken(vetId) {
  return jwt.sign({ sub: String(vetId) }, getSecret(), { expiresIn: EXPIRACAO });
}

// Verifica e devolve o id do veterinário (número) ou lança erro.
function verifyAuthToken(token) {
  const payload = jwt.verify(token, getSecret());
  const vetId = Number(payload.sub);
  if (!vetId || Number.isNaN(vetId)) {
    throw new Error('Token sem sub válido');
  }
  return vetId;
}

module.exports = { signAuthToken, verifyAuthToken };
