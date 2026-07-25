'use strict';
const { Model } = require('sequelize');

// Fila/log de lembretes automáticos da agenda (Fase 2), ligada a web_agendamentos.
module.exports = (sequelize, DataTypes) => {
  class WebLembretes extends Model {}

  WebLembretes.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      web_agendamentos_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'web_agendamentos', key: 'id' } },
      tp_lembrete: { type: DataTypes.STRING(20), allowNull: false }, // lembrete_24h | lembrete_2h | confirmacao | retorno
      canal: { type: DataTypes.STRING(15), allowNull: false }, // email | whatsapp
      dt_agendado_para: { type: DataTypes.DATE, allowNull: false },
      dt_enviado: { type: DataTypes.DATE, allowNull: true },
      st_status: { type: DataTypes.STRING(15), allowNull: false, defaultValue: 'pendente' }, // pendente | enviando | enviado | erro | cancelado
      ds_erro: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: 'WebLembretes',
      tableName: 'web_lembretes',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );

  return WebLembretes;
};
