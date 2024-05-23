'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Mob_tipo_vermifugos extends Model {


  }
  Mob_tipo_vermifugos.init({
    ds_tipo_vermifugos: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'mob_tipo_vermifugos',
  });
  return Mob_tipo_vermifugos;
};