'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Mob_imagens_feridas extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Mob_imagens_feridas.init({
    mob_feridas_id: DataTypes.INTEGER,
    ds_caminho_server: DataTypes.STRING,
    vl_largura_imagem: DataTypes.FLOAT,
    vl_altura_imagem: DataTypes.FLOAT,
    vl_largura_detector: DataTypes.FLOAT,
    vl_altura_detector: DataTypes.FLOAT,
    vl_eixo_x: DataTypes.FLOAT,
    vl_eixo_y: DataTypes.FLOAT
  }, {
    sequelize,
    modelName: 'mob_imagens_feridas',
  });
  return Mob_imagens_feridas;
};