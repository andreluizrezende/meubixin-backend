'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Mob_tipo_via_administracao extends Model {


  }
  Mob_tipo_via_administracao.init({
    ds_tipo_via_administracao: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Mob_tipo_via_administracao',
    tableName:'mob_tipo_via_administracao',
    timestamps: false 
  });
  return Mob_tipo_via_administracao;
};