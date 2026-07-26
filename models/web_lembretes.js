'use strict';
const { Model } = require('sequelize');

// Fila/log de lembretes (Fase 2). Polimórfico: origem 'agendamento' (ligado a
// web_agendamentos) ou 'dose' (vacina/vermífugo/medicamento de web_protocolos_agendas).
module.exports = (sequelize, DataTypes) => {
  class WebLembretes extends Model {}

  WebLembretes.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      tp_origem: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'agendamento' }, // agendamento | dose
      web_agendamentos_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'web_agendamentos', key: 'id' } },
      web_veterinarios_id: { type: DataTypes.INTEGER, allowNull: true },
      mob_animais_id: { type: DataTypes.INTEGER, allowNull: true },
      ds_titulo: { type: DataTypes.STRING(255), allowNull: true },
      ds_ref: { type: DataTypes.STRING(190), allowNull: true }, // dedup dos lembretes de dose
      tp_lembrete: { type: DataTypes.STRING(20), allowNull: false }, // lembrete_24h|lembrete_2h|dose_vacina|dose_vermifugo|dose_medicamento
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
