'use strict';

/** @type {import('sequelize-cli').Migration} */
// Base comum dos ATESTADOS: o endereço do RESPONSÁVEL é conteúdo mínimo exigido
// pela Resolução CFMV 1.321/2020, e mob_tutores (7 colunas: id, no_completo,
// nu_cpf, ds_email, nu_telefone_completo, createdAt, updatedAt) NÃO pode ser
// alterada — só web_* é alterável. Por isso vira satélite, chaveado por
// mob_tutores_id, mesmo padrão de web_pet_perfil / web_consentimento.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('web_tutor_perfil', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      mob_tutores_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true, // 1 linha por responsável (find-or-create no PUT)
        references: { model: 'mob_tutores', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      ds_logradouro: { type: Sequelize.STRING(255), allowNull: true },
      nu_numero: { type: Sequelize.STRING(20), allowNull: true }, // aceita "s/n"
      ds_complemento: { type: Sequelize.STRING(120), allowNull: true },
      ds_bairro: { type: Sequelize.STRING(120), allowNull: true },
      ds_cidade: { type: Sequelize.STRING(120), allowNull: true },
      ds_uf: { type: Sequelize.STRING(2), allowNull: true },
      nu_cep: { type: Sequelize.STRING(9), allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('web_tutor_perfil');
  },
};
