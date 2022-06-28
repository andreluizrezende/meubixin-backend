'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mob_sistema_digestorio', {
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
      ds_apetite: {
        type: Sequelize.STRING
      },
      ds_regurgitacao: {
        type: Sequelize.STRING
      },
      ds_fezes: {
        type: Sequelize.STRING
      },
      ds_ingestao_agua: {
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
    await queryInterface.dropTable('mob_sistema_digestorio');
  }
};