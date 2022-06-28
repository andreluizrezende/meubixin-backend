'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mob_sistema_cardio_respiratorio', {
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
      ds_respiracao: {
        type: Sequelize.STRING
      },
      ds_tosse: {
        type: Sequelize.STRING
      },
      ds_espirro: {
        type: Sequelize.STRING
      },
      ds_secrecao_nasal: {
        type: Sequelize.STRING
      },
      ds_secrecao_ocular: {
        type: Sequelize.STRING
      },
      ds_intolerancia_exercicio: {
        type: Sequelize.STRING
      },
      ds_aumento_volume: {
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
    await queryInterface.dropTable('mob_sistema_cardio_respiratorio');
  }
};