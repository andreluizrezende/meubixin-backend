'use strict';
const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class WebAnamneses extends Model {

  }
  
  WebAnamneses.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      web_veterinarios_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'web_veterinarios',
          key: 'id'
        }
      },
      mob_animais_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'mob_animais',
          key: 'id'
        }
      },
      dt_data_anamnese: {
        type: DataTypes.DATE,
        allowNull: true
      },
      ds_quadro_clinico: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      ds_resultados_exames_anteriores: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      ds_diagnostico: {
        type: DataTypes.STRING(5055),
        allowNull: true
      },
      ds_tratamento: {
        type: DataTypes.STRING(5055),
        allowNull: true
      },
      ds_orientacoes: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      vl_peso: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      ds_temperatura: {
        type: DataTypes.STRING(255),
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: 'WebAnamneses',
      tableName: 'web_anamneses',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt'
    }
  );
  
  return WebAnamneses;
};