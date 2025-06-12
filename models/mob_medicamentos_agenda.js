'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Mob_medicamentos_agenda extends Model {
    static associate(models) {
      // Associação com mob_medicamentos
      Mob_medicamentos_agenda.belongsTo(models.Mob_medicamentos, {
        foreignKey: 'mob_medicamentos_id',
        as: 'medicamento',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      });
    }
  }
  
  Mob_medicamentos_agenda.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    mob_medicamentos_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'mob_medicamentos',
        key: 'id'
      }
    },
    dt_administracao: {
      type: DataTypes.DATE,
      allowNull: false
    },
    st_concluido: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'Mob_medicamentos_agenda',
    tableName: 'mob_medicamentos_agenda',
    timestamps: false // Assumindo que não há campos createdAt/updatedAt na tabela
  });
  
  return Mob_medicamentos_agenda;
};