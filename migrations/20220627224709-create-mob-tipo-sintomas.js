'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mob_tipo_sintomas', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      ds_tipo_sintomas: {
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
    await queryInterface.dropTable('mob_tipo_sintomas');
  }
};