'use strict';

/** @type {import('sequelize-cli').Migration} */
// Retenção/Perfil (Fase B): raça do animal em web_pet_perfil (dado complementar,
// pois mob_animais não tem raça e não pode ser alterada). A lista de raças é
// filtrada por espécie (cão/gato) na tela de perfil.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('web_pet_perfil', 'ds_raca', { type: Sequelize.STRING(120), allowNull: true });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('web_pet_perfil', 'ds_raca');
  },
};
