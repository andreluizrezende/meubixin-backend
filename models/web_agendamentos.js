'use strict';
const { Model } = require('sequelize');

// Agenda de consultas/retornos/procedimentos do veterinário (Fase 1).
module.exports = (sequelize, DataTypes) => {
  class WebAgendamentos extends Model {}

  WebAgendamentos.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      web_veterinarios_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'web_veterinarios', key: 'id' } },
      mob_animais_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'mob_animais', key: 'id' } },
      tp_agendamento: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'consulta' },
      dt_inicio: { type: DataTypes.DATE, allowNull: false },
      nu_duracao_min: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
      ds_titulo: { type: DataTypes.STRING(255), allowNull: true },
      ds_status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'agendado' },
      ds_local: { type: DataTypes.STRING(255), allowNull: true },
      web_conferencias_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'web_conferencias', key: 'id' } },
      ds_email_responsavel: { type: DataTypes.STRING(255), allowNull: true },
      nu_telefone_responsavel: { type: DataTypes.STRING(30), allowNull: true },
      ds_observacoes: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: 'WebAgendamentos',
      tableName: 'web_agendamentos',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );

  return WebAgendamentos;
};
