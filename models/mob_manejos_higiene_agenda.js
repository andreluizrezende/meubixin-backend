'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class MobManejosHigieneAgenda extends Model {
    static associate(models) {
      // Definindo a associação
      MobManejosHigieneAgenda.belongsTo(models.mob_manejos_higiene, {
        foreignKey: 'mob_manejos_higiene_id',
        as: 'manejosHigiene'
      });
    }
  }
  
  MobManejosHigieneAgenda.init({
    mob_manejos_higiene_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'mob_manejos_higiene',
        key: 'id'
      }
    },
    dt_higiene: {
      type: DataTypes.DATE,
      allowNull: false
    },
    st_concluido: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'mob_manejos_higiene_agenda',
    tableName: 'mob_manejos_higiene_agenda',
    timestamps: false
  });

  return MobManejosHigieneAgenda;
};
