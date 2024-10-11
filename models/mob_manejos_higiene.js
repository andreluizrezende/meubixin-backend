'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class MobManejosHigiene extends Model {
    static associate(models) {
      // Definindo as associações, se necessário
      MobManejosHigiene.belongsTo(models.mob_animais, {
        foreignKey: 'mob_animal_id',
        as: 'animal'
      });
    }
  }
  
  MobManejosHigiene.init({
    mob_animal_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'mob_animais',
        key: 'id'
      }
    },
    tipo_manejos_higiene_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'mob_tipo_higiene',
        key: 'id'
      }
    },
    nu_reagendamentos: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    nu_intervalo_dias: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'mob_manejos_higiene',
    tableName: 'mob_manejos_higiene',
    timestamps: false
  });

  return MobManejosHigiene;
};
