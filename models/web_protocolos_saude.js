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
      ds_protocolos_saude: {
        type: DataTypes.STRING,
        allowNull: false
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
