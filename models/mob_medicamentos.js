'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Mob_medicamentos extends Model {

  }
  
  Mob_medicamentos.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    mob_animal_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    no_medicamento: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    mob_tipo_via_administracao_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    ds_dosagem: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    ds_observacao: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    ds_intervalo_administracao: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    ho_administracao_medicamento: {
      type: DataTypes.TIME,
      allowNull: false
    },
    nu_doses: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Mob_medicamentos',
    tableName: 'mob_medicamentos',
    timestamps: false // Assumindo que não há campos createdAt/updatedAt na tabela
  });
  
  return Mob_medicamentos;
};