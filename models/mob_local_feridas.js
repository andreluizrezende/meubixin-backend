'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Mob_local_feridas extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Mob_local_feridas.init({
    ds_local_feridas: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'mob_local_feridas',
  });
  return Mob_local_feridas;
};