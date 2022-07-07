'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mob_anamneses', {
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
      mob_animais_id: {
        references: {
          model: {
            tableName: 'mob_animais',
          },
          key: 'id'
        },
        type: Sequelize.INTEGER
      },
      ds_temperamento: {
        type: Sequelize.STRING
      },
      vl_peso: {
        type: Sequelize.FLOAT
      },
      ds_talhe: {
        type: Sequelize.STRING
      },
      ds_raca: {
        type: Sequelize.STRING
      },
      ds_trauma: {
        type: Sequelize.STRING
      },
      vl_cirurgia: {
        type: Sequelize.INTEGER
      },
      ds_claudicacao: {
        type: Sequelize.STRING
      },
      dt_data:{
        type: Sequelize.DATE
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
    await queryInterface.dropTable('mob_anamneses');
  }
};