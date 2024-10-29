'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Mob_tipo_especies extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      
    }
  }
  Mob_tipo_especies.init({
    ds_tipo_especies: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'mob_tipo_especies',
  });
  return Mob_tipo_especies;
};