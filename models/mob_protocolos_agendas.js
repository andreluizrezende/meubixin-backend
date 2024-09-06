'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Mob_protocolos_agendas extends Model {
    // Você pode adicionar métodos de associação ou outras funcionalidades aqui, se necessário
  }

  Mob_protocolos_agendas.init({
    mob_protocolos_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'mob_protocolos', // Nome da tabela referenciada
        key: 'id' // Chave primária da tabela referenciada
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    dt_data_aplicacao: {
      type: DataTypes.DATE,
      allowNull: false
    },
    st_concluido: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0 // Valor padrão para indicar que não está concluído
    },
    ds_caminho_server:{
      type: DataTypes.STRING,
      allowNull: true

    }
  }, {
    sequelize,
    modelName: 'mob_protocolos_agendas',
    tableName: 'mob_protocolos_agendas',
    timestamps: false
  });

  return Mob_protocolos_agendas;
};
