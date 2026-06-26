'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('web_cobranca_anexos', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      web_cobrancas_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'web_cobrancas', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      nome_original: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      s3_key: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      content_type: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      tamanho_bytes: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('web_cobranca_anexos');
  }
};
