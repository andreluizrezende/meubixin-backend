'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class WebAssinaturas extends Model {
    static associate(models) {
      WebAssinaturas.belongsTo(models.web_veterinarios, {
        foreignKey: 'web_veterinarios_id',
        as: 'veterinario'
      });
    }
  }

  WebAssinaturas.init(
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
        unique: true,
        references: { model: 'web_veterinarios', key: 'id' }
      },
      stripe_customer_id: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      stripe_subscription_id: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'inativa'
      },
      plano: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      current_period_end: {
        type: DataTypes.DATE,
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: 'WebAssinaturas',
      tableName: 'web_assinaturas',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt'
    }
  );

  return WebAssinaturas;
};
