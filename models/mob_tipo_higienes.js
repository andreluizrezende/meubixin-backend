'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Mob_tipo_higienes extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */

  }
  Mob_tipo_higienes.init({
    ds_tipo_higienes: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'mob_tipo_higienes',
  });
  return Mob_tipo_higienes;
};