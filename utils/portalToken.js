'use strict';

// Emissão/verificação do JWT de sessão do RESPONSÁVEL (Portal do Responsável / app
// mobile). `sub` = mob_tutores_id; `scope: 'portal'` distingue do token do vet (um
// não vale no outro). Segredo em JWT_SECRET (o mesmo do vet).

const jwt = require('jsonwebtoken');

const EXPIRACAO = '30d'; // sessão longa: é app do tutor no celular
const SCOPE = 'portal';

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET não configurado no ambiente');
  return secret;
}

// Assina um token para o responsável (mob_tutores_id).
function signPortalToken(tutorId) {
  return jwt.sign({ sub: String(tutorId), scope: SCOPE }, getSecret(), { expiresIn: EXPIRACAO });
}

// Verifica e devolve o mob_tutores_id (número) ou lança erro. Rejeita tokens que
// não sejam do escopo 'portal' (ex.: token de veterinário).
function verifyPortalToken(token) {
  const payload = jwt.verify(token, getSecret());
  if (payload.scope !== SCOPE) throw new Error('Token fora do escopo do portal');
  const tutorId = Number(payload.sub);
  if (!tutorId || Number.isNaN(tutorId)) throw new Error('Token sem sub válido');
  return tutorId;
}

module.exports = { signPortalToken, verifyPortalToken };
