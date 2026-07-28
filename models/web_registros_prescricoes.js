'use strict';
const { Model } = require('sequelize');


module.exports = (sequelize, DataTypes) => {
  const web_registros_prescricoes = sequelize.define('web_registros_prescricoes', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    // POLIMÓRFICA: rastreia o PDF assinado de uma PRESCRIÇÃO (web_anamneses) ou de
    // um ATESTADO (web_atestados). Exatamente um dos dois ids é preenchido.
    tp_origem: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'prescricao' // prescricao | atestado
    },
    web_anamneses_id: {
      type: DataTypes.INTEGER,
      allowNull: true, // null quando tp_origem = 'atestado'
      references: {
        model: 'web_anamneses',
        key: 'id'
      }
    },
    web_atestados_id: {
      type: DataTypes.INTEGER,
      allowNull: true, // null quando tp_origem = 'prescricao'
      references: {
        model: 'web_atestados',
        key: 'id'
      }
    },
    codigo_verificacao: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true
    },
    status: {
      type: DataTypes.ENUM('pendente', 'assinada', 'expirada', 'erro'),
      defaultValue: 'pendente'
    },
    hash_original: {
      type: DataTypes.STRING(64),
      allowNull: false
    },
    arquivo_s3_path: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    dt_criacao: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    dt_expiracao: {
      type: DataTypes.DATE,
      allowNull: false
    },
    dt_assinatura: {
      type: DataTypes.DATE,
      allowNull: true
    },
    dt_upload: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'web_registros_prescricoes',
    timestamps: false,
    indexes: [
      {
        fields: ['codigo_verificacao']
      },
      {
        fields: ['status']
      },
      {
        fields: ['dt_expiracao']
      }
    ]
  });

  web_registros_prescricoes.associate = function(models) {
    web_registros_prescricoes.belongsTo(models.WebAnamneses, {
      foreignKey: 'web_anamneses_id',
      as: 'anamnese'
    });
    web_registros_prescricoes.belongsTo(models.WebAtestados, {
      foreignKey: 'web_atestados_id',
      as: 'atestado'
    });
  };

  return web_registros_prescricoes;
};