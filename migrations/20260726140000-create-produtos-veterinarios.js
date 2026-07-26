'use strict';

/** @type {import('sequelize-cli').Migration} */
// Catálogo de PRODUTOS VETERINÁRIOS (base "estilo ANVISA" para o lado animal).
// Como o MAPA/PUBLIVET não tem CSV aberto (só painel Qlik), a base é montada por
// scraping da API pública de catálogo (VTEX) de e-commerce pet — ver
// scripts/importarProdutosVeterinarios.js. Só nome/marca/espécie/princípio ativo/
// indicação (sem nº de registro oficial). Tabela web_* (única alterável).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('web_produtos_veterinarios', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      fonte: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'cobasi' },
      id_externo: { type: Sequelize.STRING(60), allowNull: false }, // productId da fonte
      nome: { type: Sequelize.STRING(255), allowNull: false },
      marca: { type: Sequelize.STRING(120), allowNull: true },
      especie: { type: Sequelize.STRING(60), allowNull: true },       // Cachorro/Gato/...
      categoria: { type: Sequelize.STRING(120), allowNull: true },    // Medicamentos
      subcategoria: { type: Sequelize.STRING(120), allowNull: true }, // Vermífugo/Antipulgas/...
      principio_ativo: { type: Sequelize.STRING(500), allowNull: true }, // Composição
      indicacao: { type: Sequelize.TEXT, allowNull: true },
      apresentacao: { type: Sequelize.STRING(255), allowNull: true },
      via: { type: Sequelize.STRING(80), allowNull: true },           // Modo de Aplicação
      porte: { type: Sequelize.STRING(120), allowNull: true },
      descricao: { type: Sequelize.TEXT('long'), allowNull: true },
      link: { type: Sequelize.STRING(255), allowNull: true },
      st_ativo: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 1 },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('web_produtos_veterinarios', ['fonte', 'id_externo'], {
      name: 'web_prod_vet_fonte_idext', unique: true,
    });
    await queryInterface.addIndex('web_produtos_veterinarios', ['nome'], { name: 'web_prod_vet_nome' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('web_produtos_veterinarios');
  },
};
