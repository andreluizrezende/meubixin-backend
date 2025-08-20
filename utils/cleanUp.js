// ===============================================
// JOB DE LIMPEZA - utils/cleanupJobs.js
// ===============================================

const WebPasswordResetToken = require('../models/WebPasswordResetToken');

// Job para limpar tokens expirados (executar a cada hora)
async function cleanupExpiredTokens() {
  try {
    console.log('🧹 Iniciando limpeza de tokens expirados...');
    
    const now = new Date();
    
    // Marcar tokens expirados
    const expiredCount = await WebPasswordResetToken.update(
      { status: 'expired' },
      {
        where: {
          status: 'active',
          expires_at: {
            [require('sequelize').Op.lt]: now
          }
        }
      }
    );
    
    // Remover tokens antigos (mais de 7 dias)
    const deletedCount = await WebPasswordResetToken.deleteOld(7);
    
    console.log(`✅ Limpeza concluída: ${expiredCount[0]} expirados, ${deletedCount} removidos`);
    
  } catch (error) {
    console.error('❌ Erro na limpeza de tokens:', error);
  }
}

// Configurar job para executar a cada hora
const setupCleanupJob = () => {
  setInterval(cleanupExpiredTokens, 60 * 60 * 1000); // 1 hora
  console.log('⏰ Job de limpeza de tokens configurado (execução a cada hora)');
};

module.exports = {
  cleanupExpiredTokens,
  setupCleanupJob
};