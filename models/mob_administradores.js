'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Mob_administradores extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Mob_administradores.init({
    mob_usuarios_id: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'mob_administradores',
  });
  return Mob_administradores;
};