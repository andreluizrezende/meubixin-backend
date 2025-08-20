const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WebPasswordResetToken = sequelize.define('WebPasswordResetToken', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    web_veterinario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'web_veterinarios',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    token_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      comment: 'SHA-256 hash do token original'
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Email usado na solicitação (para validação)'
    },
    telefone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Telefone usado na solicitação (para validação)'
    },
    cpf: {
      type: DataTypes.STRING(11),
      allowNull: false,
      comment: 'CPF usado na solicitação (sempre obrigatório)'
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Data/hora de expiração do token'
    },
    used_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Data/hora que o token foi usado'
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: 'IP da solicitação (IPv4 ou IPv6)'
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'User agent do navegador'
    },
    status: {
      type: DataTypes.ENUM('active', 'used', 'expired'),
      defaultValue: 'active',
      allowNull: false
    },
    request_method: {
      type: DataTypes.ENUM('email', 'telefone'),
      allowNull: false,
      comment: 'Método escolhido para receber o token'
    }
  }, {
    tableName: 'web_password_reset_tokens',
    modelName: 'web_password_reset_token', // Adicionado aqui
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    
    // Índices adicionais
    indexes: [
      {
        unique: true,
        fields: ['token_hash']
      },
      {
        fields: ['web_veterinario_id']
      },
      {
        fields: ['expires_at']
      },
      {
        fields: ['status', 'expires_at']
      },
      {
        fields: ['created_at']
      },
      {
        // Índice composto para busca por veterinário e status
        fields: ['web_veterinario_id', 'status']
      }
    ],
    
    // Hooks do modelo
    hooks: {
      // Antes de criar, definir expiração se não foi informada
      beforeCreate: (token, options) => {
        if (!token.expires_at) {
          const expiration = new Date();
          expiration.setMinutes(expiration.getMinutes() + 15); // 15 minutos
          token.expires_at = expiration;
        }
      },
      
      // Depois de criar, logar para auditoria
      afterCreate: (token, options) => {
        console.log(`🔐 Token de reset criado para veterinário ${token.web_veterinario_id} via ${token.request_method}`);
      }
    }
  });

  
  WebPasswordResetToken.deleteOld = function(daysOld = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    return this.destroy({
      where: {
        [sequelize.Sequelize.Op.or]: [
          { status: 'used' },
          { status: 'expired' }
        ],
        created_at: {
          [sequelize.Sequelize.Op.lt]: cutoffDate
        }
      }
    });
  };

  return WebPasswordResetToken;
};