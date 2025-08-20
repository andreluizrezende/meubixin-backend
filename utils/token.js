// ===============================================
// FUNÇÕES UTILITÁRIAS - utils/tokenUtils.js
// ===============================================

const crypto = require('crypto');

/**
 * Gera token criptograficamente seguro
 * @param {number} bytes - Tamanho em bytes (default: 32 = 256 bits)
 * @returns {string} Token em formato URL-safe base64
 */
function generateSecureToken(bytes = 32) {
  // Gerar bytes aleatórios e converter para base64 URL-safe
  return crypto.randomBytes(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, ''); // Remove padding
}

/**
 * Gera hash SHA-256 do token para armazenar no banco
 * @param {string} token - Token original
 * @returns {string} Hash SHA-256 em formato hexadecimal
 */
function hashToken(token) {
  return crypto.createHash('sha256')
    .update(token)
    .digest('hex');
}

/**
 * Verifica se token corresponde ao hash (timing-safe)
 * @param {string} token - Token fornecido
 * @param {string} storedHash - Hash armazenado no banco
 * @returns {boolean} True se corresponder
 */
function verifyToken(token, storedHash) {
  const tokenHash = hashToken(token);
  
  // Usar timing-safe comparison para prevenir timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(tokenHash, 'hex'),
    Buffer.from(storedHash, 'hex')
  );
}

/**
 * Gera data de expiração
 * @param {number} minutes - Minutos para expirar (default: 15)
 * @returns {Date} Data de expiração
 */
function getExpirationDate(minutes = 15) {
  const expiration = new Date();
  expiration.setMinutes(expiration.getMinutes() + minutes);
  return expiration;
}

/**
 * Valida se token ainda é válido baseado no registro do banco
 * @param {Object} tokenRecord - Registro da tabela web_password_reset_tokens
 * @returns {Object} { valid: boolean, reason?: string }
 */
function validateTokenRecord(tokenRecord) {
  if (!tokenRecord) {
    return { 
      valid: false, 
      reason: 'TOKEN_NOT_FOUND',
      message: 'Token não encontrado'
    };
  }
  
  // Verificar se já foi usado
  if (tokenRecord.status === 'used' || tokenRecord.used_at) {
    return { 
      valid: false, 
      reason: 'TOKEN_ALREADY_USED',
      message: 'Token já foi utilizado'
    };
  }
  
  // Verificar expiração
  const now = new Date();
  const expiresAt = new Date(tokenRecord.expires_at);
  
  if (tokenRecord.status === 'expired' || now > expiresAt) {
    return { 
      valid: false, 
      reason: 'TOKEN_EXPIRED',
      message: 'Token expirado'
    };
  }
  
  return { 
    valid: true,
    reason: 'TOKEN_VALID',
    message: 'Token válido'
  };
}

/**
 * Extrai informações do User-Agent
 * @param {string} userAgent - String do User-Agent
 * @returns {Object} Informações extraídas
 */
function parseUserAgent(userAgent) {
  if (!userAgent) return { browser: 'unknown', os: 'unknown' };
  
  // Detecção básica de navegador
  let browser = 'unknown';
  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Edge')) browser = 'Edge';
  
  // Detecção básica de OS
  let os = 'unknown';
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac OS')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iOS')) os = 'iOS';
  
  return { browser, os };
}

/**
 * Formatar tempo restante até expiração
 * @param {Date} expiresAt - Data de expiração
 * @returns {string} Tempo formatado
 */
function formatTimeRemaining(expiresAt) {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffMs = expires.getTime() - now.getTime();
  
  if (diffMs <= 0) return 'Expirado';
  
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
  
  if (diffMinutes > 0) {
    return `${diffMinutes}min ${diffSeconds}s`;
  } else {
    return `${diffSeconds}s`;
  }
}

/**
 * Limitar tentativas por IP (rate limiting simples)
 * @param {string} ipAddress - IP do cliente
 * @param {number} maxAttempts - Máximo de tentativas (default: 3)
 * @param {number} windowMinutes - Janela de tempo em minutos (default: 15)
 * @returns {Object} { allowed: boolean, remaining?: number, resetTime?: Date }
 */
const attemptTracker = new Map();

function checkRateLimit(ipAddress, maxAttempts = 3, windowMinutes = 15) {
  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;
  
  if (!attemptTracker.has(ipAddress)) {
    attemptTracker.set(ipAddress, { count: 1, firstAttempt: now });
    return { allowed: true, remaining: maxAttempts - 1 };
  }
  
  const record = attemptTracker.get(ipAddress);
  
  // Reset se passou da janela de tempo
  if (now - record.firstAttempt > windowMs) {
    attemptTracker.set(ipAddress, { count: 1, firstAttempt: now });
    return { allowed: true, remaining: maxAttempts - 1 };
  }
  
  // Incrementar contador
  record.count++;
  
  if (record.count > maxAttempts) {
    const resetTime = new Date(record.firstAttempt + windowMs);
    return { 
      allowed: false, 
      remaining: 0,
      resetTime,
      message: `Muitas tentativas. Tente novamente após ${formatTimeRemaining(resetTime)}`
    };
  }
  
  return { 
    allowed: true, 
    remaining: maxAttempts - record.count 
  };
}

/**
 * Validar dados de entrada da solicitação
 * @param {Object} data - Dados da solicitação
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateResetRequest(data) {
  const errors = [];
  
  // Validar email OU telefone
  if (!data.ds_email && !data.nu_telefone_completo) {
    errors.push('Email ou telefone deve ser fornecido');
  }
  
  // Validar email se fornecido
  if (data.ds_email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.ds_email)) {
      errors.push('Formato de email inválido');
    }
  }
  
  // Validar telefone se fornecido
  if (data.nu_telefone_completo) {
    const phoneNumbers = data.nu_telefone_completo.replace(/\D/g, '');
    if (phoneNumbers.length < 10 || phoneNumbers.length > 11) {
      errors.push('Telefone deve ter 10 ou 11 dígitos');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitizar dados para log (remover informações sensíveis)
 * @param {Object} data - Dados originais
 * @returns {Object} Dados sanitizados
 */
function sanitizeForLog(data) {
  const sanitized = { ...data };
  
  // Mascarar CPF
  if (sanitized.nu_cpf) {
    const cpf = sanitized.nu_cpf.replace(/\D/g, '');
    sanitized.nu_cpf = cpf.slice(0, 3) + '***' + cpf.slice(-2);
  }
  
  // Mascarar email
  if (sanitized.ds_email) {
    const [local, domain] = sanitized.ds_email.split('@');
    sanitized.ds_email = local.slice(0, 2) + '***@' + domain;
  }
  
  // Mascarar telefone
  if (sanitized.nu_telefone_completo) {
    const phone = sanitized.nu_telefone_completo.replace(/\D/g, '');
    sanitized.nu_telefone_completo = phone.slice(0, 2) + '***' + phone.slice(-2);
  }
  
  return sanitized;
}

module.exports = {
  generateSecureToken,
  hashToken,
  verifyToken,
  getExpirationDate,
  validateTokenRecord,
  parseUserAgent,
  formatTimeRemaining,
  checkRateLimit,
  validateResetRequest,
  sanitizeForLog
};