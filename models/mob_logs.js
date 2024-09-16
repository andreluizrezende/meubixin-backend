'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Mob_logs extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Mob_logs.init({
    ds_funcionalidade: DataTypes.STRING,
    nu_cpf: DataTypes.BIGINT,
    dt_acesso: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'mob_logs',
    timestamps:false
  });
  return Mob_logs;
};