'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('web_veterinarios', 'stripe_connect_account_id', {
      type: Sequelize.STRING(255),
      allowNull: true,
      unique: true
    });
    await queryInterface.addColumn('web_veterinarios', 'stripe_charges_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await queryInterface.addColumn('web_veterinarios', 'stripe_details_submitted', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await queryInterface.addColumn('web_veterinarios', 'stripe_customer_id', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('web_veterinarios', 'stripe_connect_account_id');
    await queryInterface.removeColumn('web_veterinarios', 'stripe_charges_enabled');
    await queryInterface.removeColumn('web_veterinarios', 'stripe_details_submitted');
    await queryInterface.removeColumn('web_veterinarios', 'stripe_customer_id');
  }
};
