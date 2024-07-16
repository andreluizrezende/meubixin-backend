'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Mob_animais extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Mob_animais.belongsTo(models.mob_tutores, { foreignKey: 'mob_tutores_id' });
    }
  }
  Mob_animais.init({
    mob_tutores_id: DataTypes.INTEGER,
    no_nome: DataTypes.STRING,
    ds_especie: DataTypes.STRING,
    ds_sexo: DataTypes.STRING,
    ds_pelagem: DataTypes.STRING,
    vl_idade: DataTypes.INTEGER,
    vl_peso: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0
    },
  }, {
    sequelize,
    modelName: 'mob_animais',
  });
  return Mob_animais;
};