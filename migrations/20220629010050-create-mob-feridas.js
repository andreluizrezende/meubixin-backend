'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mob_feridas', {
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
      mob_tipo_exsudatos_id: {
        references: {
          model: {
            tableName: 'mob_tipo_exsudatos',
          },
          key: 'id'
        },
        type: Sequelize.INTEGER
      },
      mob_tipo_sintomas_id: {
        references: {
          model: {
            tableName: 'mob_tipo_sintomas',
          },
          key: 'id'
        },
        type: Sequelize.INTEGER
      },
      mob_local_feridas_id: {
        references: {
          model: {
            tableName: 'mob_local_feridas',
          },
          key: 'id'
        },
        type: Sequelize.INTEGER
      },
      mob_tipo_tecidos_id: {
        references: {
          model: {
            tableName: 'mob_tipo_tecidos',
          },
          key: 'id'
        },
        type: Sequelize.INTEGER
      },
      mob_qtd_exsudatos_id: {
        references: {
          model: {
            tableName: 'mob_qtd_exsudatos',
          },
          key: 'id'
        },
        type: Sequelize.INTEGER
      },
      vl_comprimento: {
        type: Sequelize.FLOAT
      },
      vl_largura: {
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
    await queryInterface.dropTable('mob_feridas');
  }
};