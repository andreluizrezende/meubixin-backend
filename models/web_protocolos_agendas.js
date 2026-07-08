'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class WebProtocolosAgendas extends Model {
    static associate(models) {
      WebProtocolosAgendas.belongsTo(models.WebProtocolos, { foreignKey: 'web_protocolos_id' });
    }
  }
  
  WebProtocolosAgendas.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      web_protocolos_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'web_protocolos',
          key: 'id'
        }
      },
      dt_data_aplicacao: {
        type: DataTypes.DATE,
        allowNull: false
      },
      st_concluido: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      ds_caminho_server: {
        type: DataTypes.STRING(255),
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: 'WebProtocolosAgendas',
      tableName: 'web_protocolos_agendas',
      timestamps: false
    }
  );
  
  return WebProtocolosAgendas;
};