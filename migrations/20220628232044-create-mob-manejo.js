'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mob_manejos', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      mob_animais_id: {
        references: {
          model: {
            tableName: 'mob_animais',
          },
          key: 'id'
        },
        type: Sequelize.INTEGER
      },
      mob_antecedentes_morbidos_id: {
        references: {
          model: {
            tableName: 'mob_antecedentes_morbidos',
          },
          key: 'id'
        },
        type: Sequelize.INTEGER
      },
      ds_presenca_ectoparazitas: {
        type: Sequelize.STRING
      },
      ds_ambiente: {
        type: Sequelize.STRING
      },
      ds_dieta: {
        type: Sequelize.STRING
      },
      ds_banhos: {
        type: Sequelize.STRING
      },
      ds_vacinacao: {
        type: Sequelize.STRING
      },
      ds_contactantes: {
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
    await queryInterface.dropTable('mob_manejos');
  }
};