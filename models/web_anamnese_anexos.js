'use strict';
const { Model } = require('sequelize');
// Laudos anexados ao prontuário (Res. CFMV 1.321/2020, alterada pela 1.653/2025).
// O arquivo vive no S3; aqui fica só o ponteiro + metadados.
module.exports = (sequelize, DataTypes) => {
  class WebAnamneseAnexos extends Model {
    static associate(models) {
      WebAnamneseAnexos.belongsTo(models.WebAnamneses, {
        foreignKey: 'web_anamneses_id',
        as: 'anamnese',
      });
    }
  }

  WebAnamneseAnexos.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      web_anamneses_id: {
        type: DataTypes.INTEGER, allowNull: false,
        references: { model: 'web_anamneses', key: 'id' },
      },
      // laboratorial | imagem | outro
      tp_anexo: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'laboratorial' },
      ds_descricao: { type: DataTypes.STRING(255), allowNull: true },
      dt_exame: { type: DataTypes.DATEONLY, allowNull: true },
      nome_original: { type: DataTypes.STRING(255), allowNull: false },
      s3_key: { type: DataTypes.STRING(255), allowNull: false },
      content_type: { type: DataTypes.STRING(100), allowNull: true },
      tamanho_bytes: { type: DataTypes.INTEGER, allowNull: true },
    },
    {
      sequelize,
      modelName: 'WebAnamneseAnexos',
      tableName: 'web_anamnese_anexos',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );

  return WebAnamneseAnexos;
};
