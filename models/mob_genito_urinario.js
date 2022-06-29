'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Mob_genito_urinario extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Mob_genito_urinario.init({
    mob_anamneses_id: DataTypes.INTEGER,
    ds_miccao: DataTypes.STRING,
    ds_libido: DataTypes.STRING,
    ds_cruzamentos: DataTypes.STRING,
    ds_castrado: DataTypes.STRING,
    ds_agressivo: DataTypes.STRING,
    ds_postura_miccao: DataTypes.STRING,
    vl_intervalo_cios: DataTypes.INTEGER,
    ds_pseudociese: DataTypes.STRING,
    ds_contraceptivos: DataTypes.STRING,
    ds_corrimento: DataTypes.STRING,
    ds_secrecao: DataTypes.STRING,
    ds_parto_anterior: DataTypes.STRING,
    ds_aborto: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'mob_genito_urinario',
  });
  return Mob_genito_urinario;
};