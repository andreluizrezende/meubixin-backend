'use strict';
/** @type {import('sequelize-cli').Migration} */
// Mensagem personalizada por envio (construtor de campanhas). Se nula, o motor
// usa a mensagem padrão do tipo de gatilho.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('web_campanha_envios', 'ds_mensagem', { type: Sequelize.TEXT, allowNull: true });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('web_campanha_envios', 'ds_mensagem');
  },
};
