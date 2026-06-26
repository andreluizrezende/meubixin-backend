'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class WebCobrancas extends Model {
    static associate(models) {
      WebCobrancas.hasMany(models.WebCobrancaItens, {
        foreignKey: 'web_cobrancas_id',
        as: 'itens'
      });
      WebCobrancas.hasMany(models.WebPagamentos, {
        foreignKey: 'web_cobrancas_id',
        as: 'pagamentos'
      });
      WebCobrancas.hasMany(models.WebCobrancaAnexos, {
        foreignKey: 'web_cobrancas_id',
        as: 'anexos'
      });
    }
  }

  WebCobrancas.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      web_veterinarios_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'web_veterinarios', key: 'id' }
      },
      cliente_nome: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      cliente_email: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      cliente_documento: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('rascunho', 'pendente_pagamento', 'paga', 'cancelada'),
        allowNull: false,
        defaultValue: 'rascunho'
      },
      total_cents: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      currency: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'brl'
      },
      descricao: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      stripe_checkout_session_id: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      stripe_payment_intent_id: {
        type: DataTypes.STRING(255),
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: 'WebCobrancas',
      tableName: 'web_cobrancas',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt'
    }
  );

  return WebCobrancas;
};
