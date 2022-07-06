'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Mob_tutores extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Mob_tutores.hasMany(models.mob_animais, { foreignKey: 'mob_tutores_id' });
    }
  }
  Mob_tutores.init({
    no_completo: DataTypes.STRING,
    nu_cpf: DataTypes.BIGINT,
    ds_email: DataTypes.STRING,
    nu_telefone_completo: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'mob_tutores',
  });
  return Mob_tutores;
};