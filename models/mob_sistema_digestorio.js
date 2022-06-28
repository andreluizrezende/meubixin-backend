'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class mob_sistema_digestorio extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  mob_sistema_digestorio.init({
    mob_anamneses_id: DataTypes.INTEGER,
    ds_apetite: DataTypes.STRING,
    ds_regurgitacao: DataTypes.STRING,
    ds_fezes: DataTypes.STRING,
    ds_ingestao_agua: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'mob_sistema_digestorio',
    freezeTableName: true
  });
  return mob_sistema_digestorio;
};