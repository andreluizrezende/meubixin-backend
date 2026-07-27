'use strict';

/** @type {import('sequelize-cli').Migration} */
// Portal do Responsável (Fase 2) — pedido de horário feito pelo tutor. Cai como
// PENDENTE para o vet, que confirma (vira web_agendamentos) ou recusa. Tabela do
// app mobile → prefixo `mol_`.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mol_agenda_solicitacao', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      mob_animais_id: { type: Sequelize.INTEGER, allowNull: false },
      web_veterinarios_id: { type: Sequelize.INTEGER, allowNull: false }, // vet resolvido por CRMV
      mob_tutores_id: { type: Sequelize.INTEGER, allowNull: true },
      tp_agendamento: { type: Sequelize.STRING(30), allowNull: true },     // consulta/retorno/...
      dt_sugerida: { type: Sequelize.DATE, allowNull: true },
      ds_motivo: { type: Sequelize.STRING(255), allowNull: true },
      ds_status: { type: Sequelize.STRING(15), allowNull: false, defaultValue: 'pendente' }, // pendente|aceita|recusada
      web_agendamentos_id: { type: Sequelize.INTEGER, allowNull: true },   // preenchido ao aceitar
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('mol_agenda_solicitacao', ['web_veterinarios_id', 'ds_status'], { name: 'mol_ag_sol_vet_status' });
    await queryInterface.addIndex('mol_agenda_solicitacao', ['mob_tutores_id'], { name: 'mol_ag_sol_tutor' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('mol_agenda_solicitacao');
  },
};
