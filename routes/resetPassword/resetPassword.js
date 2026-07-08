// ===============================================
// ROTAS PARA RESET DE SENHA - routes/resetPassword.js
// ===============================================

const express = require('express');
const bcrypt = require('bcrypt');
const axios = require('axios');
const { 
  generateSecureToken, 
  hashToken, 
  verifyToken, 
  getExpirationDate, 
  validateTokenRecord,
  parseUserAgent,
  checkRateLimit,
  validateResetRequest,
  sanitizeForLog
} = require('../../utils/token');
const models = require('../../models');
const { sendResetPasswordEmail } = require('../../utils/emailService');

const router = express.Router();

// Assumindo que você tem esses models definidos

const { web_veterinarios, WebPasswordResetToken: web_password_reset_token } = models;


// ===============================================
// 1. ROTA: SOLICITAR RESET DE SENHA
// ===============================================
router.post('/web-veterinarios/request-reset', async (req, res) => {
  try {
    const { nu_crmv, ds_email, nu_telefone_completo } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    console.log('🔐 Solicitação de reset de senha recebida:', sanitizeForLog(req.body));

    // ✅ 1. Validar entrada
    const validation = validateResetRequest(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: validation.errors
      });
    }

    // // ✅ 2. Verificar rate limiting
    // const rateLimitResult = checkRateLimit(clientIp, 3, 15); // 3 tentativas por 15 min
    // if (!rateLimitResult.allowed) {
    //   return res.status(429).json({
    //     success: false,
    //     message: rateLimitResult.message,
    //     resetTime: rateLimitResult.resetTime
    //   });
    // }

    // ✅ 3. Buscar veterinário
    const whereClause = { nu_crmv: parseInt(nu_crmv) };
    
    if (ds_email) {
      whereClause.ds_email = ds_email;
    } else if (nu_telefone_completo) {
      whereClause.nu_telefone_completo = nu_telefone_completo.replace(/\D/g, '');
    }

    const veterinario = await web_veterinarios.findOne({ where: whereClause });

    if (!veterinario) {
      // ⚠️ Por segurança, não revelar se o usuário existe ou não
      return res.status(200).json({
        success: true,
        message: 'Se os dados estiverem corretos, você receberá um link para redefinir sua senha.'
      });
    }

    // ✅ 4. Invalidar tokens anteriores do mesmo veterinário
    await web_password_reset_token.update(
      { status: 'expired' },
      { 
        where: { 
          web_veterinario_id: veterinario.id,
          status: 'active'
        }
      }
    );

    // ✅ 5. Gerar novo token
    const plainToken = generateSecureToken(32); // 256 bits
    const tokenHash = hashToken(plainToken);
    const expiresAt = getExpirationDate(15); // 15 minutos

    // ✅ 6. Salvar token no banco
    const resetToken = await web_password_reset_token.create({
      web_veterinario_id: veterinario.id,
      token_hash: tokenHash,
      email: ds_email || null,
      telefone: nu_telefone_completo?.replace(/\D/g, '') || null,
      cpf: veterinario.nu_cpf,
      expires_at: expiresAt,
      ip_address: clientIp,
      user_agent: userAgent,
      request_method: ds_email ? 'email' : 'telefone'
    });

    // ✅ 7. Enviar por email ou WhatsApp
    const resetUrl = `${process.env.CLIENT_URL || 'https://meubixin.vercel.app'}/reset-password?token=${plainToken}&id=${veterinario.id}`;

    if (ds_email) {
      // 📧 Enviar por email
      await sendResetPasswordEmail({
        email: ds_email,
        name: veterinario.no_completo,
        resetUrl: resetUrl,
        expiresAt: expiresAt
      });
      
      console.log(`✅ Email de reset enviado para: ${ds_email}`);
    } else if (nu_telefone_completo) {
      // 📱 Enviar por WhatsApp
      await sendResetWhatsApp(nu_telefone_completo, veterinario.no_completo, resetUrl);
      
      console.log(`✅ WhatsApp de reset enviado para: ${nu_telefone_completo}`);
    }

    // ✅ 8. Resposta de sucesso
    res.status(200).json({
      success: true,
      message: 'Se os dados estiverem corretos, você receberá um link para redefinir sua senha.',
      method: ds_email ? 'email' : 'whatsapp'
    });

  } catch (error) {
    console.error('❌ Erro ao solicitar reset de senha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor. Tente novamente mais tarde.'
    });
  }
});

// ===============================================
// 2. ROTA: VALIDAR TOKEN (OPCIONAL - para verificar se token é válido)
// ===============================================
router.get('/web-veterinarios/validate-token/:token/:veterinarioId', async (req, res) => {
  try {
    const { token, veterinarioId } = req.params;

    // ✅ 1. Buscar token no banco
    const tokenRecord = await web_password_reset_token.findOne({
      where: {
        web_veterinario_id: parseInt(veterinarioId),
        status: 'active'
      }
    });

    // ✅ 2. Validar token
    const validation = validateTokenRecord(tokenRecord);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
        reason: validation.reason
      });
    }

    // ✅ 3. Verificar hash
    const isValidToken = verifyToken(token, tokenRecord.token_hash);
    if (!isValidToken) {
      return res.status(400).json({
        success: false,
        message: 'Token inválido',
        reason: 'INVALID_TOKEN'
      });
    }

    // ✅ 4. Buscar dados do veterinário
    const veterinario = await web_veterinarios.findByPk(veterinarioId);
    if (!veterinario) {
      return res.status(404).json({
        success: false,
        message: 'Veterinário não encontrado'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Token válido',
      veterinario: {
        id: veterinario.id,
        name: veterinario.no_completo,
        email: veterinario.ds_email
      }
    });

  } catch (error) {
    console.error('❌ Erro ao validar token:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ===============================================
// 3. ROTA: REDEFINIR SENHA
// ===============================================
router.post('/web-veterinarios/reset-password', async (req, res) => {
  try {
    const { token, veterinarioId, nova_senha, confirmar_senha } = req.body;

    console.log('🔐 Tentativa de redefinição de senha para veterinário:', veterinarioId);

    // ✅ 1. Validações básicas
    if (!token || !veterinarioId || !nova_senha || !confirmar_senha) {
      return res.status(400).json({
        success: false,
        message: 'Token, ID do veterinário e senhas são obrigatórios'
      });
    }

    if (nova_senha !== confirmar_senha) {
      return res.status(400).json({
        success: false,
        message: 'As senhas não coincidem'
      });
    }

    if (nova_senha.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'A senha deve ter pelo menos 6 caracteres'
      });
    }

    // ✅ 2. Buscar token ativo
    const tokenRecord = await web_password_reset_token.findOne({
      where: {
        web_veterinario_id: parseInt(veterinarioId),
        status: 'active'
      }
    });

    // ✅ 3. Validar token
    const validation = validateTokenRecord(tokenRecord);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
        reason: validation.reason
      });
    }

    // ✅ 4. Verificar hash do token
    const isValidToken = verifyToken(token, tokenRecord.token_hash);
    if (!isValidToken) {
      return res.status(400).json({
        success: false,
        message: 'Token inválido ou expirado',
        reason: 'INVALID_TOKEN'
      });
    }

    // ✅ 5. Buscar veterinário
    const veterinario = await web_veterinarios.findByPk(veterinarioId);
    if (!veterinario) {
      return res.status(404).json({
        success: false,
        message: 'Veterinário não encontrado'
      });
    }

    // ✅ 6. Hash da nova senha
    const hashedPassword = await bcrypt.hash(nova_senha, 10);

    // ✅ 7. Atualizar senha no banco
    await web_veterinarios.update(
      { ds_senha: hashedPassword },
      { where: { id: parseInt(veterinarioId) } }
    );

    // ✅ 8. Marcar token como usado
    await web_password_reset_token.update(
      { 
        status: 'used',
        used_at: new Date()
      },
      { where: { id: tokenRecord.id } }
    );

    // ✅ 9. Invalidar todos os outros tokens ativos deste veterinário
    await web_password_reset_token.update(
      { status: 'expired' },
      { 
        where: { 
          web_veterinario_id: parseInt(veterinarioId),
          status: 'active',
          id: { [require('sequelize').Op.ne]: tokenRecord.id }
        }
      }
    );

    console.log(`✅ Senha redefinida com sucesso para veterinário ID: ${veterinarioId}`);

    res.status(200).json({
      success: true,
      message: 'Senha redefinida com sucesso! Você pode fazer login com sua nova senha.',
      code: 'PASSWORD_RESET_SUCCESS'
    });

  } catch (error) {
    console.error('❌ Erro ao redefinir senha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor. Tente novamente mais tarde.'
    });
  }
});

// ===============================================
// FUNÇÃO AUXILIAR: ENVIAR WHATSAPP
// ===============================================
async function sendResetWhatsApp(telefone, nome, resetUrl) {
  try {
    // Formatar número para WhatsApp
    let numeroFormatado = telefone.replace(/\D/g, '');
    
    // sem DDI: 11 dígitos (DDD + 9 + 8) → remove o 9 e prepende 55
    if (numeroFormatado.length === 11 && numeroFormatado[2] === '9') {
      numeroFormatado = numeroFormatado.substring(0, 2) + numeroFormatado.substring(3);
    }

    // Adicionar código do país
    if (!numeroFormatado.startsWith('55')) {
      numeroFormatado = '55' + numeroFormatado;
    }

    // com DDI: 13 dígitos (55 + DDD + 9 + 8) → remove o 9
    if (numeroFormatado.length === 13 && numeroFormatado[4] === '9') {
      numeroFormatado = numeroFormatado.substring(0, 4) + numeroFormatado.substring(5);
    }
    
    const toNumber = `${numeroFormatado}@s.whatsapp.net`;
    
    // Criar mensagem HTML com embed
    const message = `🔐 *Redefinição de Senha - Meu Bixin*

Olá, *${nome}*!

Recebemos uma solicitação para redefinir a senha da sua conta.

🔗 *Clique no link abaixo para redefinir sua senha:*
${resetUrl}

⏰ Este link expira em 15 minutos por segurança.

⚠️ Não solicitou esta redefinição? Ignore esta mensagem.

---
*Meu Bixin*`;

    const payload = {
      to: toNumber,
      message: message
    };

    console.log(payload)

    const response = await axios.post(
      "https://coral-app-f97ui.ondigitalocean.app/send-message",
      payload,
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    console.log('✅ WhatsApp enviado com sucesso:', response.data);
    return true;

  } catch (error) {
    console.error('❌ Erro ao enviar WhatsApp:', error);
    throw error;
  }
}

module.exports = router;


