'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('web_protocolos_saude', 'st_uso_humano', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false, // catálogo existente é veterinário
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('web_protocolos_saude', 'st_uso_humano');
  },
};
