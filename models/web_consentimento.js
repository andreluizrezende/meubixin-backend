'use strict';
const { Model } = require('sequelize');
// Retenção (Fase A): consentimento de comunicação por tutor (LGPD).
module.exports = (sequelize, DataTypes) => {
  class WebConsentimento extends Model {}
  WebConsentimento.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      mob_tutores_id: { type: DataTypes.INTEGER, allowNull: false, unique: true, references: { model: 'mob_tutores', key: 'id' } },
      st_email: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      st_whatsapp: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      st_marketing: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    },
    { sequelize, modelName: 'WebConsentimento', tableName: 'web_consentimento', timestamps: true, createdAt: 'createdAt', updatedAt: 'updatedAt' }
  );
  return WebConsentimento;
};
