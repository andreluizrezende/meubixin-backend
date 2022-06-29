'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Mob_antecedentes_morbidos extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Mob_antecedentes_morbidos.init({
    ds_diagnosticos: DataTypes.STRING,
    ds_resultados_exames_complementares: DataTypes.STRING,
    ds_tratamentos: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'mob_antecedentes_morbidos',
  });
  return Mob_antecedentes_morbidos;
};