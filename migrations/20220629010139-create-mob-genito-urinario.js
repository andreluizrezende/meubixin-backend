'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mob_genito_urinarios', {
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
      ds_miccao: {
        type: Sequelize.STRING
      },
      ds_libido: {
        type: Sequelize.STRING
      },
      ds_cruzamentos: {
        type: Sequelize.STRING
      },
      ds_castrado: {
        type: Sequelize.STRING
      },
      ds_agressivo: {
        type: Sequelize.STRING
      },
      ds_postura_miccao: {
        type: Sequelize.STRING
      },
      vl_intervalo_cios: {
        type: Sequelize.INTEGER
      },
      ds_pseudociese: {
        type: Sequelize.STRING
      },
      ds_contraceptivos: {
        type: Sequelize.STRING
      },
      ds_corrimento: {
        type: Sequelize.STRING
      },
      ds_secrecao: {
        type: Sequelize.STRING
      },
      ds_parto_anterior: {
        type: Sequelize.STRING
      },
      ds_aborto: {
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
    await queryInterface.dropTable('mob_genito_urinarios');
  }
};