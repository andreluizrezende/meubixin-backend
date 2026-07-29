'use strict';
const { Model } = require('sequelize');
// Retenção (Fase B): satélite de mob_animais (atributos que não existem em mob).
module.exports = (sequelize, DataTypes) => {
  class WebPetPerfil extends Model {}
  WebPetPerfil.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      mob_animais_id: { type: DataTypes.INTEGER, allowNull: false, unique: true, references: { model: 'mob_animais', key: 'id' } },
      dt_nascimento: { type: DataTypes.DATEONLY, allowNull: true },
      ds_raca: { type: DataTypes.STRING(120), allowNull: true },
      ds_doencas_cronicas: { type: DataTypes.TEXT, allowNull: true },
      ds_porte: { type: DataTypes.STRING(30), allowNull: true },
      st_castrado: { type: DataTypes.INTEGER, allowNull: true },
      // Identificação exigida pelos Anexos I/II/XI da Res. CFMV 1.321/2020
      // (migration 20260729160000). A lista da norma é: nome, sexo, raça, idade,
      // pelagem, sinais particulares, tatuagem, brinco, microchip, registro
      // genealógico e — conforme o caso — resenha detalhada.
      ds_sinais_particulares: { type: DataTypes.TEXT, allowNull: true },
      ds_tatuagem: { type: DataTypes.STRING(60), allowNull: true },
      ds_brinco: { type: DataTypes.STRING(60), allowNull: true },
      nu_microchip: { type: DataTypes.STRING(30), allowNull: true },
      ds_registro_genealogico: { type: DataTypes.STRING(60), allowNull: true },
      ds_resenha: { type: DataTypes.TEXT, allowNull: true },
    },
    { sequelize, modelName: 'WebPetPerfil', tableName: 'web_pet_perfil', timestamps: true, createdAt: 'createdAt', updatedAt: 'updatedAt' }
  );
  return WebPetPerfil;
};
