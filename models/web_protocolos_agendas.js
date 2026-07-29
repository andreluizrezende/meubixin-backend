'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class WebProtocolosAgendas extends Model {
    static associate(models) {
      WebProtocolosAgendas.belongsTo(models.WebProtocolos, { foreignKey: 'web_protocolos_id' });
    }
  }
  
  WebProtocolosAgendas.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      web_protocolos_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'web_protocolos',
          key: 'id'
        }
      },
      dt_data_aplicacao: {
        type: DataTypes.DATE,
        allowNull: false
      },
      st_concluido: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      ds_caminho_server: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      // Imunobiológico aplicado — conteúdo do atestado/carteira de vacinação
      // (Resolução CFMV 1.321/2020). Nulos nas doses registradas antes disso.
      ds_lote: { type: DataTypes.STRING(60), allowNull: true },
      ds_fabricante: { type: DataTypes.STRING(120), allowNull: true },
      dt_validade_vacina: { type: DataTypes.DATEONLY, allowNull: true },
      ds_via_aplicacao: { type: DataTypes.STRING(60), allowNull: true },
      // Quem APLICOU (pode não ser quem assina o atestado)
      web_veterinarios_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'web_veterinarios', key: 'id' }
      }
    },
    {
      sequelize,
      modelName: 'WebProtocolosAgendas',
      tableName: 'web_protocolos_agendas',
      timestamps: false
    }
  );
  
  return WebProtocolosAgendas;
};