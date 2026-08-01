'use strict';

/** @type {import('sequelize-cli').Migration} */
// Data de FABRICAÇÃO do imunobiológico, pedida pelo Anexo XI (atestado de
// vacinação) da Res. CFMV 1.321/2020, alterada pela 1.653/2025.
//
// A migration 20260728140000 trouxe lote/fabricante/validade/via, mas não a
// fabricação — a norma pede as duas datas. Nullable como as irmãs: doses antigas
// não têm o dado, e o gerador omite a coluna quando ninguém preencheu.
//
// DATEONLY (não DATE) pelo mesmo motivo de dt_validade_vacina: é data de rótulo
// do frasco, sem hora — e assim não sofre deslocamento de fuso.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('web_protocolos_agendas', 'dt_fabricacao_vacina', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('web_protocolos_agendas', 'dt_fabricacao_vacina');
  },
};
