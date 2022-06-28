'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mob_sistema_nervoso_locomotor', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      mob_anamneses_id: {
        references: {
          model: {
            tableName: 'mob_anamneses',
          },
          key: 'id'
        },
        type: Sequelize.INTEGER
      },
      ds_convulsoes: {
        type: Sequelize.STRING
      },
      ds_alteracao_comportamento: {
        type: Sequelize.STRING
      },
      ds_postura: {
        type: Sequelize.STRING
      },
      ds_possibilidade_intoxicacao: {
        type: Sequelize.STRING
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('mob_sistema_nervoso_locomotor');
  }
};