'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('web_cobrancas', {
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
      cliente_nome: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      cliente_email: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      cliente_documento: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('rascunho', 'pendente_pagamento', 'paga', 'cancelada'),
        allowNull: false,
        defaultValue: 'rascunho'
      },
      total_cents: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      currency: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: 'brl'
      },
      descricao: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      stripe_checkout_session_id: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      stripe_payment_intent_id: {
        type: Sequelize.STRING(255),
        allowNull: true
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
    await queryInterface.dropTable('web_cobrancas');
  }
};
