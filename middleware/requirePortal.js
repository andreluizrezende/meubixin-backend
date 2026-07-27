'use strict';

// Autenticação do PORTAL DO RESPONSÁVEL: exige JWT de escopo 'portal' no header
// Authorization e injeta o id do responsável em req.tutorId. As rotas devem usar
// req.tutorId como identidade — NUNCA um id vindo do corpo/query/URL.

const { verifyPortalToken } = require('../utils/portalToken');

function requirePortal(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ success: false, message: 'Acesso necessário' });
    }
    req.tutorId = verifyPortalToken(token);
    return next();
  } catch (err) {
    if (err && err.message === 'JWT_SECRET não configurado no ambiente') {
      console.error('requirePortal:', err.message);
      return res.status(500).json({ success: false, message: 'Configuração de autenticação ausente' });
    }
    return res.status(401).json({ success: false, message: 'Sessão inválida ou expirada' });
  }
}

module.exports = requirePortal;
