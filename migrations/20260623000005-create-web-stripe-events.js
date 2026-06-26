'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('web_stripe_events', {
      event_id: {
        type: Sequelize.STRING(255),
        primaryKey: true,
        allowNull: false
      },
      processed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('web_stripe_events');
  }
};
