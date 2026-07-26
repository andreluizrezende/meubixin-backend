'use strict';
const { Model } = require('sequelize');

// Catálogo de produtos veterinários (base "estilo ANVISA" do lado animal).
// Alimentado por scripts/importarProdutosVeterinarios.js (API pública VTEX).
module.exports = (sequelize, DataTypes) => {
  class WebProdutosVeterinarios extends Model {}

  WebProdutosVeterinarios.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      fonte: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'cobasi' },
      id_externo: { type: DataTypes.STRING(60), allowNull: false },
      nome: { type: DataTypes.STRING(255), allowNull: false },
      marca: { type: DataTypes.STRING(120), allowNull: true },
      especie: { type: DataTypes.STRING(60), allowNull: true },
      categoria: { type: DataTypes.STRING(120), allowNull: true },
      subcategoria: { type: DataTypes.STRING(120), allowNull: true },
      principio_ativo: { type: DataTypes.STRING(500), allowNull: true },
      indicacao: { type: DataTypes.TEXT, allowNull: true },
      apresentacao: { type: DataTypes.STRING(255), allowNull: true },
      via: { type: DataTypes.STRING(80), allowNull: true },
      porte: { type: DataTypes.STRING(120), allowNull: true },
      descricao: { type: DataTypes.TEXT('long'), allowNull: true },
      link: { type: DataTypes.STRING(255), allowNull: true },
      st_ativo: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
    },
    {
      sequelize,
      modelName: 'WebProdutosVeterinarios',
      tableName: 'web_produtos_veterinarios',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );

  return WebProdutosVeterinarios;
};
