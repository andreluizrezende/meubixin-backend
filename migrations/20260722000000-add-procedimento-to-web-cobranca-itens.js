'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('web_cobranca_itens', 'procedimento', {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: null
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('web_cobranca_itens', 'procedimento');
  }
};
