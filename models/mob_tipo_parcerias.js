'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Mob_tipo_parcerias extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
     
    }
  }
  Mob_tipo_parcerias.init({
    ds_tipo_parceria: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'mob_tipo_parcerias',
  });
  return Mob_tipo_parcerias;
};