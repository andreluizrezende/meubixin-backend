'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Mob_sistema_nervoso_locomotor extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Mob_sistema_nervoso_locomotor.init({
    mob_anamneses_id: DataTypes.INTEGER,
    ds_convulsoes: DataTypes.STRING,
    ds_alteracao_comportamento: DataTypes.STRING,
    ds_postura: DataTypes.STRING,
    ds_possibilidade_intoxicacao: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'mob_sistema_nervoso_locomotor',
    freezeTableName: true
  });
  return Mob_sistema_nervoso_locomotor;
};