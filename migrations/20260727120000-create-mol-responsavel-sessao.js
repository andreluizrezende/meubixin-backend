'use strict';

/** @type {import('sequelize-cli').Migration} */
// Portal do Responsável (app mobile) — emissão de acesso SEM SENHA. Cada linha é um
// pedido de acesso: OTP (código 6 dígitos) + token de link mágico, com validade curta.
// A SESSÃO em si é um JWT de escopo 'portal' (utils/portalToken.js) — não fica aqui.
// Convenção: tabelas do app mobile usam prefixo `mol_`.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mol_responsavel_sessao', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      mob_tutores_id: { type: Sequelize.INTEGER, allowNull: false },
      codigo: { type: Sequelize.STRING(6), allowNull: false },       // OTP digitado no app
      token: { type: Sequelize.STRING(64), allowNull: false },        // link mágico
      canal: { type: Sequelize.STRING(15), allowNull: true },         // whatsapp | email
      dt_expira: { type: Sequelize.DATE, allowNull: false },
      usado_em: { type: Sequelize.DATE, allowNull: true },
      ip: { type: Sequelize.STRING(60), allowNull: true },
      user_agent: { type: Sequelize.STRING(255), allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('mol_responsavel_sessao', ['token'], { name: 'mol_resp_sessao_token' });
    await queryInterface.addIndex('mol_responsavel_sessao', ['mob_tutores_id'], { name: 'mol_resp_sessao_tutor' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('mol_responsavel_sessao');
  },
};
