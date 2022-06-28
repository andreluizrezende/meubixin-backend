'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class mob_sistema_genito_urinario extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  mob_sistema_genito_urinario.init({
    mob_anamneses_id: DataTypes.INTEGER,
    ds_miccao: DataTypes.STRING,
    ds_femeas: DataTypes.STRING,
    ds_machos: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'mob_sistema_genito_urinario',
    freezeTableName: true
  });
  return mob_sistema_genito_urinario;
};