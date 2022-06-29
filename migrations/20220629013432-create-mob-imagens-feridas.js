'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mob_imagens_feridas', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      mob_feridas_id: {
        references: {
          model: {
            tableName: 'mob_feridas',
          },
          key: 'id'
        },
        type: Sequelize.INTEGER
      },
      ds_caminho_server: {
        type: Sequelize.STRING
      },
      vl_largura_imagem: {
        type: Sequelize.FLOAT
      },
      vl_altura_imagem: {
        type: Sequelize.FLOAT
      },
      vl_largura_detector: {
        type: Sequelize.FLOAT
      },
      vl_altura_detector: {
        type: Sequelize.FLOAT
      },
      vl_eixo_x: {
        type: Sequelize.FLOAT
      },
      vl_eixo_y: {
        type: Sequelize.FLOAT
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
    await queryInterface.dropTable('mob_imagens_feridas');
  }
};