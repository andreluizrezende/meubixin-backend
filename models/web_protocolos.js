'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class WebProtocolos extends Model {
    
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
      mob_protocolos_saude_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'mob_protocolos_saude',
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
