'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Mob_sistema_cardio_respiratorio extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Mob_sistema_cardio_respiratorio.init({
    mob_anamneses_id: DataTypes.INTEGER,
    ds_respiracao: DataTypes.STRING,
    ds_tosse: DataTypes.STRING,
    ds_espirro: DataTypes.STRING,
    ds_secrecao_nasal: DataTypes.STRING,
    ds_secrecao_ocular: DataTypes.STRING,
    ds_intolerancia_exercicio: DataTypes.STRING,
    ds_aumento_volume: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'mob_sistema_cardio_respiratorio',
    freezeTableName: true
  });
  return Mob_sistema_cardio_respiratorio;
};