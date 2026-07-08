'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class WebProtocolos extends Model {
    static associate(models) {
      WebProtocolos.belongsTo(models.WebAnamneses, { foreignKey: 'web_anamneses_id' });
      WebProtocolos.hasMany(models.WebProtocolosAgendas, { as: 'agendas', foreignKey: 'web_protocolos_id' });
      WebProtocolos.belongsTo(models.mob_protocolos_saude, { as: 'protocolo_saude', foreignKey: 'web_protocolos_saude_id' });
    }
  }

  WebProtocolos.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      web_anamneses_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'web_anamneses',
          key: 'id'
        }
      },
      web_protocolos_saude_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'web_protocolos_saude',
          key: 'id'
        }
      },
      nu_doses: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      nu_intervalo_uso: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      tipo_intervalo_uso: {
        type: DataTypes.STRING(2),
        allowNull: false
      },
      ds_dosagem: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      st_tipo_protocolo: {
        type: DataTypes.INTEGER,
        allowNull: false
      }
    },
    {
      sequelize,
      modelName: 'WebProtocolos',
      tableName: 'web_protocolos',
      timestamps: false
    }
  );

  return WebProtocolos;
};
