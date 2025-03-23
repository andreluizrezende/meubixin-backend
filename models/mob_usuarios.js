'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Mob_usuarios extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Mob_usuarios.init({
    no_completo: DataTypes.STRING,
    ds_senha: DataTypes.STRING,
    ds_email: DataTypes.STRING,
    nu_telefone_completo: DataTypes.STRING,
    nu_cpf: DataTypes.BIGINT,
    st_envia_mensagem: {
      type: DataTypes.TINYINT,
      defaultValue: 0
    }
  }, {
    sequelize,
    modelName: 'mob_usuarios',
  });
  return Mob_usuarios;
};