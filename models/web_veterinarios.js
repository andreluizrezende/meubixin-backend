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
    ds_logo_s3: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    ds_assinatura_s3: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    // Endereço profissional + estabelecimento: conteúdo mínimo dos atestados
    // (Resolução CFMV 1.321/2020) e do "Grupo B" da Receita.
    ds_logradouro: { type: DataTypes.STRING(255), allowNull: true },
    nu_numero: { type: DataTypes.STRING(20), allowNull: true },
    ds_complemento: { type: DataTypes.STRING(120), allowNull: true },
    ds_bairro: { type: DataTypes.STRING(120), allowNull: true },
    ds_cidade: { type: DataTypes.STRING(120), allowNull: true },
    ds_uf: { type: DataTypes.STRING(2), allowNull: true },
    nu_cep: { type: DataTypes.STRING(9), allowNull: true },
    ds_clinica_nome: { type: DataTypes.STRING(255), allowNull: true },
    nu_clinica_cnpj: { type: DataTypes.STRING(18), allowNull: true },
    nu_clinica_crmv_pj: { type: DataTypes.STRING(30), allowNull: true },
    stripe_connect_account_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true
    },
    stripe_charges_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    stripe_details_submitted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    stripe_customer_id: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    sequelize,
    modelName: "web_veterinarios",
  });
  return Web_veterinarios;
};