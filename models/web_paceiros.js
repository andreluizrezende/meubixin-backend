"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Web_parceiros extends Model {
    static associate(models) {}
  }
  Web_parceiros.init(
    {
      google_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
      },
      no_empresa: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      ds_email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      ds_senha: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      nu_cnpj: {
        type: DataTypes.STRING(18),
        allowNull: true,
        unique: true,
      },
      nu_telefone_completo: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      ds_logo_s3: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      ds_endereco: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      ds_complemento: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      ds_bairro: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      ds_cidade: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      ds_estado: {
        type: DataTypes.STRING(2),
        allowNull: true,
      },
      nu_cep: {
        type: DataTypes.STRING(9),
        allowNull: true,
      },
      nu_latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true,
      },
      nu_longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "web_parceiros",
    }
  );
  return Web_parceiros;
};