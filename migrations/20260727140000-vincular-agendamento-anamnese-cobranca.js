'use strict';

/** @type {import('sequelize-cli').Migration} */
// Costura a cadeia agendamento → consulta → cobrança, que antes só se ligava
// indiretamente pelo pet (mob_animais_id) — impossível saber qual receita/cobrança
// pertencia a qual atendimento quando o pet tinha mais de uma consulta.
//   web_anamneses.web_agendamentos_id → de qual agendamento nasceu a consulta
//   web_cobrancas.web_anamneses_id    → qual consulta está sendo cobrada
// Ambos NULL: os registros antigos continuam válidos e o vínculo é opcional
// (cobrança avulsa, sem consulta, segue funcionando). ON DELETE SET NULL para
// que apagar um agendamento nunca apague a consulta/cobrança.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('web_anamneses', 'web_agendamentos_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'web_agendamentos', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('web_anamneses', ['web_agendamentos_id'], {
      name: 'idx_web_anamneses_agendamento',
    });

    await queryInterface.addColumn('web_cobrancas', 'web_anamneses_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'web_anamneses', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('web_cobrancas', ['web_anamneses_id'], {
      name: 'idx_web_cobrancas_anamnese',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('web_cobrancas', 'idx_web_cobrancas_anamnese');
    await queryInterface.removeColumn('web_cobrancas', 'web_anamneses_id');
    await queryInterface.removeIndex('web_anamneses', 'idx_web_anamneses_agendamento');
    await queryInterface.removeColumn('web_anamneses', 'web_agendamentos_id');
  },
};
