'use strict';
const { Model } = require('sequelize');
// Atestados médico-veterinários (Resolução CFMV 1.321/2020).
// O PDF assinado é rastreado em web_registros_prescricoes (polimórfica).
module.exports = (sequelize, DataTypes) => {
  class WebAtestados extends Model {
    static associate(models) {
      WebAtestados.hasMany(models.web_registros_prescricoes, {
        foreignKey: 'web_atestados_id',
        as: 'registros',
      });
    }
  }

  WebAtestados.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      web_veterinarios_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'web_veterinarios', key: 'id' } },
      mob_animais_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'mob_animais', key: 'id' } },
      // Consulta de origem (opcional): o atestado pode ser avulso.
      web_anamneses_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'web_anamneses', key: 'id' } },
      tp_atestado: { type: DataTypes.STRING(30), allowNull: false }, // saude | vacinacao | carteira_vacinacao | obito
      ds_finalidade: { type: DataTypes.STRING(255), allowNull: true },
      ds_texto: { type: DataTypes.TEXT, allowNull: true },
      ds_observacoes: { type: DataTypes.TEXT, allowNull: true },
      dt_emissao: { type: DataTypes.DATE, allowNull: false },
      dt_validade: { type: DataTypes.DATE, allowNull: true },
      ds_status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ativo' },
      // Exclusivos do óbito (ver comentário na migration).
      dt_obito: { type: DataTypes.DATE, allowNull: true },
      ds_causa_mortis: { type: DataTypes.TEXT, allowNull: true },
      ds_local_obito: { type: DataTypes.STRING(255), allowNull: true },
      ds_destino_corpo: { type: DataTypes.STRING(255), allowNull: true },
    },
    {
      sequelize,
      modelName: 'WebAtestados',
      tableName: 'web_atestados',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );

  return WebAtestados;
};
