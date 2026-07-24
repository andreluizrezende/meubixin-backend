'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class WebProtocolosSaude extends Model {}

  WebProtocolosSaude.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      // Tipo do protocolo (FK): 3 = Medicamentos (ver web_tipo_protocolos_saude)
      web_tipo_protocolos_saude_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      ds_protocolos_saude: {
        type: DataTypes.STRING,
        allowNull: false
      },
      // 1 = medicamento de uso humano; 0 = uso veterinário (padrão)
      st_uso_humano: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }
    },
    {
      sequelize,
      modelName: 'WebProtocolosSaude',
      tableName: 'web_protocolos_saude',
      timestamps: false
    }
  );

  return WebProtocolosSaude;
};
