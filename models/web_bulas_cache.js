'use strict';
const { Model } = require('sequelize');

// Cache do texto das bulas da ANVISA. Chave lógica: (expediente, tipo).
// O `expediente` identifica a versão vigente da bula — quando a ANVISA publica
// uma nova, o expediente muda, o cache "erra" e o texto é re-coletado.
module.exports = (sequelize, DataTypes) => {
  class WebBulasCache extends Model {}

  WebBulasCache.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      expediente: { type: DataTypes.STRING(50), allowNull: false },
      tipo: { type: DataTypes.STRING(20), allowNull: false }, // 'profissional' | 'paciente'
      id_produto: { type: DataTypes.INTEGER, allowNull: true },
      nome_produto: { type: DataTypes.STRING(255), allowNull: true },
      empresa: { type: DataTypes.STRING(255), allowNull: true },
      cnpj: { type: DataTypes.STRING(30), allowNull: true },
      numero_registro: { type: DataTypes.STRING(50), allowNull: true },
      texto: { type: DataTypes.TEXT('long'), allowNull: false },
      paginas: { type: DataTypes.INTEGER, allowNull: true },
      caracteres: { type: DataTypes.INTEGER, allowNull: true },
      tamanho_pdf_bytes: { type: DataTypes.INTEGER, allowNull: true },
    },
    {
      sequelize,
      modelName: 'WebBulasCache',
      tableName: 'web_bulas_cache',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [{ unique: true, fields: ['expediente', 'tipo'] }],
    }
  );

  return WebBulasCache;
};
