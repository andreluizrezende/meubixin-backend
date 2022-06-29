'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Mob_anamneses extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Mob_anamneses.init({
    mob_usuarios_id: DataTypes.INTEGER,
    mob_animais_id: DataTypes.INTEGER,
    ds_temperamento: DataTypes.STRING,
    vl_peso: DataTypes.FLOAT,
    ds_talhe: DataTypes.STRING,
    ds_raca: DataTypes.STRING,
    ds_trauma: DataTypes.STRING,
    vl_cirurgia: DataTypes.INTEGER,
    ds_claudicacao: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'mob_anamneses',
  });
  return Mob_anamneses;
};