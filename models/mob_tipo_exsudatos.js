'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Mob_tipo_exsudatos extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Mob_tipo_exsudatos.hasMany(models.mob_feridas, { foreignKey: 'mob_tipo_exsudatos_id' });
    }
  }
  Mob_tipo_exsudatos.init({
    ds_tipo_exsudatos: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'mob_tipo_exsudatos',
  });
  return Mob_tipo_exsudatos;
};