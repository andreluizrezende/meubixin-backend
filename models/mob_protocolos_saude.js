'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class MobProtocolosSaude extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {

    }
  }
  
  MobProtocolosSaude.init(
    {
      mob_tipo_protocolos_saude_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'mob_tipo_protocolos_saude',
          key: 'id',
        },
      },
      ds_protocolos_saude: {
        type: DataTypes.STRING,
        allowNull: false,
      }
    },
    {
      sequelize,
      modelName: 'mob_protocolos_saude',
      tableName: 'mob_protocolos_saude',
      timestamps: false
    }
  );
  
  return MobProtocolosSaude;
};