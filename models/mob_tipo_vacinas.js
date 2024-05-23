'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Mob_tipo_vacinas extends Model {


  }
  Mob_tipo_vacinas.init({
    ds_tipo_vacinas: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'mob_tipo_vacinas',
  });
  return Mob_tipo_vacinas;
};