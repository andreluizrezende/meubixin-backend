'use strict';

/** @type {import('sequelize-cli').Migration} */
// Renomeia anvisa_medicamentos -> web_anvisa_medicamentos (padrão web_* do projeto).
// RENAME TABLE preserva dados e índices.
module.exports = {
  async up(queryInterface) {
    await queryInterface.renameTable('anvisa_medicamentos', 'web_anvisa_medicamentos');
  },

  async down(queryInterface) {
    await queryInterface.renameTable('web_anvisa_medicamentos', 'anvisa_medicamentos');
  },
};
