'use strict';
const { Model } = require('sequelize');

// Portal do Responsável (Fase 2) — solicitação de horário do tutor (pré-agenda).
module.exports = (sequelize, DataTypes) => {
  class MolAgendaSolicitacao extends Model {}
  MolAgendaSolicitacao.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      mob_animais_id: { type: DataTypes.INTEGER, allowNull: false },
      web_veterinarios_id: { type: DataTypes.INTEGER, allowNull: false },
      mob_tutores_id: { type: DataTypes.INTEGER, allowNull: true },
      tp_agendamento: { type: DataTypes.STRING(30), allowNull: true },
      dt_sugerida: { type: DataTypes.DATE, allowNull: true },
      ds_motivo: { type: DataTypes.STRING(255), allowNull: true },
      ds_status: { type: DataTypes.STRING(15), allowNull: false, defaultValue: 'pendente' },
      web_agendamentos_id: { type: DataTypes.INTEGER, allowNull: true },
    },
    {
      sequelize,
      modelName: 'MolAgendaSolicitacao',
      tableName: 'mol_agenda_solicitacao',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );
  return MolAgendaSolicitacao;
};
