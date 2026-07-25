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
      ds_doencas_cronicas: { type: DataTypes.TEXT, allowNull: true },
      ds_porte: { type: DataTypes.STRING(30), allowNull: true },
      st_castrado: { type: DataTypes.INTEGER, allowNull: true },
    },
    { sequelize, modelName: 'WebPetPerfil', tableName: 'web_pet_perfil', timestamps: true, createdAt: 'createdAt', updatedAt: 'updatedAt' }
  );
  return WebPetPerfil;
};
