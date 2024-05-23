'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Mob_protocolos extends Model {
   
  }
  Mob_protocolos.init({
    mob_animal_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'mob_animais', 
        key: 'id' 
      }
    },
    nu_doses: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    nu_intervalo_dias: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    st_tipo_protocolo: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        isIn: [[0, 1, 2]] 
      }
    },
    ds_protocolo: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'mob_protocolos',
    tableName: 'mob_protocolos',
    timestamps: false
  });

  return Mob_protocolos;
};
