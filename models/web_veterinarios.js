"use strict";
const {
  Model
} = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Web_veterinarios extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {

    }
  }
  Web_veterinarios.init({
    mob_veterinarios_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    mob_usuarios_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    google_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true
    },
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
      allowNull: false
    },
    ds_email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    ds_senha: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    nu_cpf: {
      type: DataTypes.STRING(14),
      allowNull: true,
      unique: true
    },
    nu_telefone_completo: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    ds_logo_s3_path: {
      type: DataTypes.STRING(500),
      allowNull: true
    }
  }, {
    sequelize,
    modelName: "web_veterinarios",
  });
  return Web_veterinarios;
};