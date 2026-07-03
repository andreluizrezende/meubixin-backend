'use strict';

// Middleware de autenticação: exige um JWT válido no header Authorization e
// injeta o id do veterinário em req.vetId. As rotas protegidas devem usar
// req.vetId como identidade — nunca um vetId vindo do corpo/query/URL.

const { verifyAuthToken } = require('../utils/authToken');

function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res
        .status(401)
        .json({ success: false, message: 'Autenticação necessária' });
    }

    req.vetId = verifyAuthToken(token);
    return next();
  } catch (err) {
    // JWT_SECRET ausente é erro de configuração do servidor, não do cliente.
    if (err && err.message === 'JWT_SECRET não configurado no ambiente') {
      console.error('requireAuth:', err.message);
      return res
        .status(500)
        .json({ success: false, message: 'Configuração de autenticação ausente' });
    }
    return res
      .status(401)
      .json({ success: false, message: 'Token inválido ou expirado' });
  }
}

module.exports = requireAuth;
