'use strict';
const { Model } = require('sequelize');

// Catálogo de medicamentos dos Dados Abertos da ANVISA (busca sem crawler).
module.exports = (sequelize, DataTypes) => {
  class AnvisaMedicamentos extends Model {}

  AnvisaMedicamentos.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      nome_produto: { type: DataTypes.STRING(255), allowNull: false },
      principio_ativo: { type: DataTypes.STRING(500), allowNull: true },
      numero_registro: { type: DataTypes.STRING(50), allowNull: true },
      empresa: { type: DataTypes.STRING(255), allowNull: true },
      categoria_regulatoria: { type: DataTypes.STRING(120), allowNull: true },
      classe_terapeutica: { type: DataTypes.STRING(255), allowNull: true },
      situacao_registro: { type: DataTypes.STRING(60), allowNull: true },
      numero_processo: { type: DataTypes.STRING(50), allowNull: true },
      tipo_produto: { type: DataTypes.STRING(60), allowNull: true },
    },
    {
      sequelize,
      modelName: 'AnvisaMedicamentos',
      tableName: 'anvisa_medicamentos',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );

  return AnvisaMedicamentos;
};
