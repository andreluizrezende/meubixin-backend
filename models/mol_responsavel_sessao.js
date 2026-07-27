'use strict';
const { Model } = require('sequelize');

// Portal do Responsável (app mobile) — pedidos de acesso sem senha (OTP + link).
module.exports = (sequelize, DataTypes) => {
  class MolResponsavelSessao extends Model {}
  MolResponsavelSessao.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      mob_tutores_id: { type: DataTypes.INTEGER, allowNull: false },
      codigo: { type: DataTypes.STRING(6), allowNull: false },
      token: { type: DataTypes.STRING(64), allowNull: false },
      canal: { type: DataTypes.STRING(15), allowNull: true },
      dt_expira: { type: DataTypes.DATE, allowNull: false },
      usado_em: { type: DataTypes.DATE, allowNull: true },
      ip: { type: DataTypes.STRING(60), allowNull: true },
      user_agent: { type: DataTypes.STRING(255), allowNull: true },
    },
    {
      sequelize,
      modelName: 'MolResponsavelSessao',
      tableName: 'mol_responsavel_sessao',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );
  return MolResponsavelSessao;
};
