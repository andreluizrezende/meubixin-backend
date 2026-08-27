'use strict';

// Middleware de autenticação do VETERINÁRIO: exige um JWT válido no header
// Authorization e injeta o id do veterinário em req.vetId. As rotas protegidas
// devem usar req.vetId como identidade — nunca um vetId vindo do corpo/query/URL.
//
// 🔴 TOKEN DE PARCEIRO É RECUSADO AQUI, e esse é o ponto do middleware.
// `web_veterinarios` e `web_parceiros` têm ids que se sobrepõem: sem a checagem
// de tipo, o parceiro 3 entraria como o veterinário 3 e veria prontuários,
// cobranças e pacientes que não são dele. Ver o cabeçalho de utils/authToken.js.

const { verifyAuthToken, TIPO_VETERINARIO } = require('../utils/authToken');

function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res
        .status(401)
        .json({ success: false, message: 'Autenticação necessária' });
    }

    const { id, tipo } = verifyAuthToken(token);

    if (tipo !== TIPO_VETERINARIO) {
      // 403, não 401: o token é válido — só não é desta área. Com 401 o
      // frontend limparia a sessão e mandaria o parceiro para o login, num
      // laço sem fim, já que ele conseguiria entrar de novo e cair aqui outra vez.
      return res.status(403).json({
        success: false,
        message: 'Esta área é exclusiva de veterinários.',
      });
    }

    req.vetId = id;
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
