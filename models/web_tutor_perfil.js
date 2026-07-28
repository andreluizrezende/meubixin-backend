'use strict';
const { Model } = require('sequelize');
// Satélite de mob_tutores: endereço do RESPONSÁVEL, conteúdo mínimo exigido pela
// Resolução CFMV 1.321/2020 nos atestados. mob_tutores não pode ser alterada
// (só web_*), daí o satélite — mesmo padrão de web_pet_perfil.
module.exports = (sequelize, DataTypes) => {
  class WebTutorPerfil extends Model {}
  WebTutorPerfil.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      mob_tutores_id: { type: DataTypes.INTEGER, allowNull: false, unique: true, references: { model: 'mob_tutores', key: 'id' } },
      ds_logradouro: { type: DataTypes.STRING(255), allowNull: true },
      nu_numero: { type: DataTypes.STRING(20), allowNull: true },
      ds_complemento: { type: DataTypes.STRING(120), allowNull: true },
      ds_bairro: { type: DataTypes.STRING(120), allowNull: true },
      ds_cidade: { type: DataTypes.STRING(120), allowNull: true },
      ds_uf: { type: DataTypes.STRING(2), allowNull: true },
      nu_cep: { type: DataTypes.STRING(9), allowNull: true },
    },
    { sequelize, modelName: 'WebTutorPerfil', tableName: 'web_tutor_perfil', timestamps: true, createdAt: 'createdAt', updatedAt: 'updatedAt' }
  );
  return WebTutorPerfil;
};
