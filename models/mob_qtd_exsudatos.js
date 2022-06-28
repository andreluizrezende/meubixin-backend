'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Mob_qtd_exsudatos extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Mob_qtd_exsudatos.init({
    ds_qtd_exsudatos: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'mob_qtd_exsudatos',
  });
  return Mob_qtd_exsudatos;
};