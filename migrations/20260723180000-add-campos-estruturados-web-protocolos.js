'use strict';

/** @type {import('sequelize-cli').Migration} */
// Grupo A: prescrição estruturada — campos usualmente exigidos no receituário
// (concentração, forma farmacêutica, quantidade a dispensar, via de administração).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('web_protocolos', 'ds_concentracao', {
      type: Sequelize.STRING(120), allowNull: true,
    });
    await queryInterface.addColumn('web_protocolos', 'ds_forma_farmaceutica', {
      type: Sequelize.STRING(120), allowNull: true,
    });
    await queryInterface.addColumn('web_protocolos', 'ds_quantidade', {
      type: Sequelize.STRING(120), allowNull: true,
    });
    await queryInterface.addColumn('web_protocolos', 'ds_via_administracao', {
      type: Sequelize.STRING(120), allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('web_protocolos', 'ds_concentracao');
    await queryInterface.removeColumn('web_protocolos', 'ds_forma_farmaceutica');
    await queryInterface.removeColumn('web_protocolos', 'ds_quantidade');
    await queryInterface.removeColumn('web_protocolos', 'ds_via_administracao');
  },
};
