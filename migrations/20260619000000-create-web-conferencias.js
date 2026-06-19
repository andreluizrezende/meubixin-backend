'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('web_conferencias', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      web_veterinarios_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'web_veterinarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      mob_animais_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'mob_animais', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      ds_room_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      ds_link: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      ds_email_tutor: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      ds_status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'agendada'
      },
      ds_anotacoes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      dt_conferencia: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('web_conferencias');
  }
};
