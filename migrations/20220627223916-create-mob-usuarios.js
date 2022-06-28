'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mob_usuarios', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      no_completo: {
        type: Sequelize.STRING
      },
      ds_senha: {
        type: Sequelize.STRING
      },
      ds_email: {
        type: Sequelize.STRING
      },
      nu_telefone_completo: {
        type: Sequelize.STRING
      },
      nu_cpf: {
        type: Sequelize.BIGINT
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
    await queryInterface.dropTable('mob_usuarios');
  }
};