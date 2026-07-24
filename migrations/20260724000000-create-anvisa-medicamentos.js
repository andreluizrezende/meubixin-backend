'use strict';

/** @type {import('sequelize-cli').Migration} */
// Catálogo de medicamentos dos DADOS ABERTOS da ANVISA (dados.anvisa.gov.br,
// fora do Cloudflare). Alimentado por scripts/importarMedicamentosAnvisa.js.
// Serve para a busca do "Consultar Bula" SEM worker/crawler.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('anvisa_medicamentos', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      nome_produto: { type: Sequelize.STRING(255), allowNull: false },
      principio_ativo: { type: Sequelize.STRING(500), allowNull: true },
      numero_registro: { type: Sequelize.STRING(50), allowNull: true },
      empresa: { type: Sequelize.STRING(255), allowNull: true },
      categoria_regulatoria: { type: Sequelize.STRING(120), allowNull: true },
      classe_terapeutica: { type: Sequelize.STRING(255), allowNull: true },
      situacao_registro: { type: Sequelize.STRING(60), allowNull: true },
      numero_processo: { type: Sequelize.STRING(50), allowNull: true },
      tipo_produto: { type: Sequelize.STRING(60), allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('anvisa_medicamentos', ['nome_produto'], {
      name: 'anvisa_medicamentos_nome',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('anvisa_medicamentos');
  },
};
