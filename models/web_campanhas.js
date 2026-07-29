'use strict';
const { Model } = require('sequelize');
// Retenção: DEFINIÇÃO de uma campanha criada pelo veterinário. Diferente dos 4
// gatilhos fixos (que são código, não dado), a campanha é um registro dele —
// por isso pode ser listada e apagada. As linhas de envio ficam em
// web_campanha_envios, apontando para cá via web_campanhas_id.
module.exports = (sequelize, DataTypes) => {
  class WebCampanhas extends Model {}
  WebCampanhas.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      web_veterinarios_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'web_veterinarios', key: 'id' } },
      ds_nome: { type: DataTypes.STRING(255), allowNull: false },
      ds_descricao: { type: DataTypes.TEXT, allowNull: true },
      ds_mensagem: { type: DataTypes.TEXT, allowNull: true },
      ds_filtros: { type: DataTypes.TEXT, allowNull: true }, // JSON dos filtros do público
    },
    { sequelize, modelName: 'WebCampanhas', tableName: 'web_campanhas', timestamps: true, createdAt: 'createdAt', updatedAt: 'updatedAt' }
  );
  return WebCampanhas;
};
