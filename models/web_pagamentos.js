'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class WebPagamentos extends Model {
    static associate(models) {
      WebPagamentos.belongsTo(models.WebCobrancas, {
        foreignKey: 'web_cobrancas_id',
        as: 'cobranca'
      });
    }
  }

  WebPagamentos.init(
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
      stripe_payment_intent_id: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      stripe_checkout_session_id: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      amount_cents: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      currency: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'brl'
      },
      stripe_fee_cents: {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: 'WebPagamentos',
      tableName: 'web_pagamentos',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt'
    }
  );

  return WebPagamentos;
};
