'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class MobParcerias extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Defina as associações aqui
      // Exemplo: `MobParcerias.belongsTo(models.MobUsuarios, { foreignKey: 'mob_usuarios_id' });`
    }
  }

  MobParcerias.init(
    {
      mob_usuarios_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'mob_usuarios',
          key: 'id',
        },
      },
      no_nome_parceiro: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      mob_tipo_parcerias_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      ds_estado: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      ds_cidade: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      nu_cep: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      nu_telefone_completo:{
        type: DataTypes.STRING,
        allowNull: false,
      },
      ds_site:{
        type: DataTypes.STRING,
        allowNull: true,
      },
      ds_instagram:{
        type: DataTypes.STRING,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: 'MobParcerias',
      tableName: 'mob_parcerias',
      timestamps: true, // Para gerenciar automaticamente createdAt e updatedAt
    }
  );

  return MobParcerias;
};
