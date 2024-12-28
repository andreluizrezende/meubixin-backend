"use strict";
const {
  Model
} = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Mob_veterinarios extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define associations here if needed in the future
    }
  }
  Mob_veterinarios.init({
    nu_crmv: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    ds_estado_crmv: {
      type: DataTypes.STRING(2),
      allowNull: true
    },
    no_completo: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    ds_email: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    nu_telefone_completo: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
    ,
    mob_usuarios_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: "mob_veterinarios",
  });
  return Mob_veterinarios;
};
