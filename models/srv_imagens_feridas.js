'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Srv_imagens_feridas extends Model {
    static associate(models) {
      Srv_imagens_feridas.belongsTo(models.mob_imagens_feridas, { foreignKey: 'mob_imagens_feridas_id' });
    }
  }
  Srv_imagens_feridas.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    mob_imagens_feridas_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    ds_caminho_server: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    vl_comprimento_manual: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    vl_largura_manual: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    vl_largura_imagem: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    vl_altura_imagem: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    vl_largura_detector: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    vl_altura_detector: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    vl_eixo_x: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    vl_eixo_y: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    vl_dimensao_cv: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    vl_dimensao_ia: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    ds_erro_processamento: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    dt_criacao: {
      type: DataTypes.DATE,
      allowNull: true
    },
    dt_processamento: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'srv_imagens_feridas',
    tableName: 'srv_imagens_feridas',
    timestamps: false, 
    freezeTableName: true
  });
  return Srv_imagens_feridas;
};
