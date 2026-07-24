'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Nome do medicamento gravado direto no protocolo (a prescrição fica
    // autocontida — cobre nomes free-text da Farmácia, que não vêm de catálogo).
    await queryInterface.addColumn('web_protocolos', 'nome_protocolo', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    // Uso humano por item da prescrição (para exibir na receita).
    await queryInterface.addColumn('web_protocolos', 'st_uso_humano', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('web_protocolos', 'nome_protocolo');
    await queryInterface.removeColumn('web_protocolos', 'st_uso_humano');
  },
};
