'use strict';
/** @type {import('sequelize-cli').Migration} */
// Descritivo da campanha (tooltip na listagem). O nome vai em ds_titulo.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('web_campanha_envios', 'ds_descricao', { type: Sequelize.TEXT, allowNull: true });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('web_campanha_envios', 'ds_descricao');
  },
};
