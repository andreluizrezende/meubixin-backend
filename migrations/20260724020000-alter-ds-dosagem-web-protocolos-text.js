'use strict';

/** @type {import('sequelize-cli').Migration} */
// Muda web_protocolos.ds_dosagem de VARCHAR(255) para TEXT — a Posologia pode
// passar de 255 caracteres (ex.: texto autopreenchido a partir da bula).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('web_protocolos', 'ds_dosagem', {
      type: Sequelize.TEXT,
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('web_protocolos', 'ds_dosagem', {
      type: Sequelize.STRING(255),
      allowNull: false,
    });
  },
};
