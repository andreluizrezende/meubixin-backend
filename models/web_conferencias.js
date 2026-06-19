'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class WebConferencias extends Model {}

  WebConferencias.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      web_veterinarios_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'web_veterinarios', key: 'id' }
      },
      mob_animais_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'mob_animais', key: 'id' }
      },
      ds_room_name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      ds_link: {
        type: DataTypes.STRING(500),
        allowNull: false
      },
      ds_email_tutor: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      ds_status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'agendada'
      },
      ds_anotacoes: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      dt_conferencia: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    },
    {
      sequelize,
      modelName: 'WebConferencias',
      tableName: 'web_conferencias',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt'
    }
  );

  return WebConferencias;
};
