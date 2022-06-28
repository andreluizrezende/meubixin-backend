'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mob_administradores', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      mob_usuarios_id: {
        references: {
          model: {
            tableName: 'mob_usuarios',
          },
          key: 'id'
        },
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
    await queryInterface.dropTable('mob_administradores');
  }
};