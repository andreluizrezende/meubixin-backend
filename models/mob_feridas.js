'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Mob_feridas extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Mob_feridas.belongsTo(models.mob_local_feridas, { foreignKey: 'mob_local_feridas_id' });
      Mob_feridas.belongsTo(models.mob_tipo_sintomas, { foreignKey: 'mob_tipo_sintomas_id' });
      Mob_feridas.belongsTo(models.mob_tipo_tecidos, { foreignKey: 'mob_tipo_tecidos_id' });
      Mob_feridas.belongsTo(models.mob_qtd_exsudatos, { foreignKey: 'mob_qtd_exsudatos_id' });
      Mob_feridas.belongsTo(models.mob_tipo_exsudatos, { foreignKey: 'mob_tipo_exsudatos_id' });
    }
  }
  Mob_feridas.init({
    mob_anamneses_id: DataTypes.INTEGER,
    mob_tipo_exsudatos_id: DataTypes.INTEGER,
    mob_tipo_sintomas_id: DataTypes.INTEGER,
    mob_local_feridas_id: DataTypes.INTEGER,
    mob_tipo_tecidos_id: DataTypes.INTEGER,
    mob_qtd_exsudatos_id: DataTypes.INTEGER,
    vl_comprimento: DataTypes.FLOAT,
    vl_largura: DataTypes.FLOAT
  }, {
    sequelize,
    modelName: 'mob_feridas',
  });
  return Mob_feridas;
};