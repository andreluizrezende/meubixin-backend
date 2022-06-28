'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class mob_sistema_oto_tegumentar extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  mob_sistema_oto_tegumentar.init({
    mob_anamneses_id: DataTypes.INTEGER,
    ds_pele: DataTypes.STRING,
    ds_orelha: DataTypes.STRING,
    ds_unha: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'mob_sistema_oto_tegumentar',
    freezeTableName: true
  });
  return mob_sistema_oto_tegumentar;
};