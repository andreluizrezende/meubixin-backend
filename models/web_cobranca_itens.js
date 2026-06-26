'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class WebCobrancaItens extends Model {
    static associate(models) {
      WebCobrancaItens.belongsTo(models.WebCobrancas, {
        foreignKey: 'web_cobrancas_id',
        as: 'cobranca'
      });
    }
  }

  WebCobrancaItens.init(
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
      descricao: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      quantidade: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      valor_unitario_cents: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      ordem: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      }
    },
    {
      sequelize,
      modelName: 'WebCobrancaItens',
      tableName: 'web_cobranca_itens',
      timestamps: false
    }
  );

  return WebCobrancaItens;
};
