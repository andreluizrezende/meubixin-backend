'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mob_animais', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      mob_tutores_id: {
        references: {
          model: {
            tableName: 'mob_tutores',
          },
          key: 'id'
        },
        type: Sequelize.INTEGER
      },
      no_nome: {
        type: Sequelize.STRING
      },
      ds_especie: {
        type: Sequelize.STRING
      },
      ds_sexo: {
        type: Sequelize.STRING
      },
      ds_pelagem: {
        type: Sequelize.STRING
      },
      vl_idade: {
        type: Sequelize.INTEGER
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
    await queryInterface.dropTable('mob_animais');
  }
};