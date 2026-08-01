'use strict';
const { Model } = require('sequelize');
// Termos de consentimento / ciência (Res. CFMV 1.321/2020, alterada pela
// 1.653/2025). O PDF assinado é rastreado em web_registros_prescricoes
// (polimórfica: tp_origem = 'termo').
//
// ⚠️ NÃO é `web_consentimento` — aquele é consentimento de comunicação (LGPD) do
// módulo de Retenção. Aqui é documento médico-legal.
module.exports = (sequelize, DataTypes) => {
  class WebTermos extends Model {
    static associate(models) {
      WebTermos.hasMany(models.web_registros_prescricoes, {
        foreignKey: 'web_termos_id',
        as: 'registros',
      });
    }
  }

  WebTermos.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      web_veterinarios_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'web_veterinarios', key: 'id' } },
      mob_animais_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'mob_animais', key: 'id' } },
      // Consulta de origem (opcional): o termo pode ser avulso.
      web_anamneses_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'web_anamneses', key: 'id' } },
      // retirada_sem_alta | cirurgico | anestesico | ciencia_risco
      tp_termo: { type: DataTypes.STRING(30), allowNull: false },
      ds_procedimento: { type: DataTypes.STRING(255), allowNull: true },
      ds_riscos: { type: DataTypes.TEXT, allowNull: true },
      ds_texto: { type: DataTypes.TEXT, allowNull: true },
      ds_observacoes: { type: DataTypes.TEXT, allowNull: true },
      // Exclusivos de retirada_sem_alta (ver comentário na migration).
      dt_retirada: { type: DataTypes.DATE, allowNull: true },
      ds_estado_clinico: { type: DataTypes.TEXT, allowNull: true },
      dt_emissao: { type: DataTypes.DATE, allowNull: false },
      ds_status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ativo' },
    },
    {
      sequelize,
      modelName: 'WebTermos',
      tableName: 'web_termos',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );

  return WebTermos;
};
