'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('web_pagamentos', {
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
      stripe_payment_intent_id: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      stripe_checkout_session_id: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      amount_cents: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      currency: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: 'brl'
      },
      stripe_fee_cents: {
        type: Sequelize.INTEGER,
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
    await queryInterface.dropTable('web_pagamentos');
  }
};
