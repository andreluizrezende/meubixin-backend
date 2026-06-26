'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class WebCobrancaAnexos extends Model {
    static associate(models) {
      WebCobrancaAnexos.belongsTo(models.WebCobrancas, {
        foreignKey: 'web_cobrancas_id',
        as: 'cobranca'
      });
    }
  }

  WebCobrancaAnexos.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      web_cobrancas_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'web_cobrancas', key: 'id' }
      },
      nome_original: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      s3_key: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      content_type: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      tamanho_bytes: {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: 'WebCobrancaAnexos',
      tableName: 'web_cobranca_anexos',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt'
    }
  );

  return WebCobrancaAnexos;
};
