'use strict';
const { Model } = require('sequelize');
// Retenção (Fase A): fila/log de envios de gatilhos de retenção.
module.exports = (sequelize, DataTypes) => {
  class WebCampanhaEnvios extends Model {}
  WebCampanhaEnvios.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      web_veterinarios_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'web_veterinarios', key: 'id' } },
      mob_animais_id: { type: DataTypes.INTEGER, allowNull: true },
      mob_tutores_id: { type: DataTypes.INTEGER, allowNull: true },
      tp_gatilho: { type: DataTypes.STRING(30), allowNull: false },
      canal: { type: DataTypes.STRING(15), allowNull: false },
      ds_titulo: { type: DataTypes.STRING(255), allowNull: true },
      ds_mensagem: { type: DataTypes.TEXT, allowNull: true },
      ds_descricao: { type: DataTypes.TEXT, allowNull: true },
      dt_agendado_para: { type: DataTypes.DATE, allowNull: false },
      dt_enviado: { type: DataTypes.DATE, allowNull: true },
      st_status: { type: DataTypes.STRING(15), allowNull: false, defaultValue: 'pendente' },
      ds_erro: { type: DataTypes.TEXT, allowNull: true },
      ds_chave_dedup: { type: DataTypes.STRING(180), allowNull: false },
    },
    { sequelize, modelName: 'WebCampanhaEnvios', tableName: 'web_campanha_envios', timestamps: true, createdAt: 'createdAt', updatedAt: 'updatedAt' }
  );
  return WebCampanhaEnvios;
};
