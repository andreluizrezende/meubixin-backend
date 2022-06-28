'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Mob_tipo_tecidos extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Mob_tipo_tecidos.init({
    ds_tipo_tecidos: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'mob_tipo_tecidos',
  });
  return Mob_tipo_tecidos;
};