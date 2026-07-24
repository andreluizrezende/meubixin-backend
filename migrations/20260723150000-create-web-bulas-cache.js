'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('web_bulas_cache', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      expediente: { type: Sequelize.STRING(50), allowNull: false },
      tipo: { type: Sequelize.STRING(20), allowNull: false },
      id_produto: { type: Sequelize.INTEGER, allowNull: true },
      nome_produto: { type: Sequelize.STRING(255), allowNull: true },
      empresa: { type: Sequelize.STRING(255), allowNull: true },
      cnpj: { type: Sequelize.STRING(30), allowNull: true },
      numero_registro: { type: Sequelize.STRING(50), allowNull: true },
      texto: { type: Sequelize.TEXT('long'), allowNull: false },
      paginas: { type: Sequelize.INTEGER, allowNull: true },
      caracteres: { type: Sequelize.INTEGER, allowNull: true },
      tamanho_pdf_bytes: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('web_bulas_cache', ['expediente', 'tipo'], {
      unique: true,
      name: 'web_bulas_cache_expediente_tipo',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('web_bulas_cache');
  },
};
