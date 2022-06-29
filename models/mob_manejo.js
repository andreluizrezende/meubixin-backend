'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Mob_manejo extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Mob_manejo.init({
    mob_animais_id: DataTypes.INTEGER,
    mob_antecedentes_morbidos_id: DataTypes.INTEGER,
    ds_presenca_ectoparazitas: DataTypes.STRING,
    ds_ambiente: DataTypes.STRING,
    ds_dieta: DataTypes.STRING,
    ds_banhos: DataTypes.STRING,
    ds_vacinacao: DataTypes.STRING,
    ds_contactantes: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'mob_manejo',
  });
  return Mob_manejo;
};