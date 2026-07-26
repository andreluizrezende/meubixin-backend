'use strict';

/** @type {import('sequelize-cli').Migration} */
// Torna web_lembretes polimórfico: além de lembrete de agendamento, passa a
// suportar lembrete de DOSE (vacina/vermífugo/medicamento de web_protocolos_agendas),
// exibidos na mesma tela de Lembretes.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('web_lembretes', 'web_agendamentos_id', {
      type: Sequelize.INTEGER,
      allowNull: true, // dose não tem agendamento
    });
    await queryInterface.addColumn('web_lembretes', 'tp_origem', {
      type: Sequelize.STRING(20), allowNull: false, defaultValue: 'agendamento', // agendamento | dose
    });
    await queryInterface.addColumn('web_lembretes', 'web_veterinarios_id', { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.addColumn('web_lembretes', 'mob_animais_id', { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.addColumn('web_lembretes', 'ds_titulo', { type: Sequelize.STRING(255), allowNull: true });
    // dedup dos lembretes de dose (NULL nos de agendamento — MySQL permite múltiplos NULL no unique)
    await queryInterface.addColumn('web_lembretes', 'ds_ref', { type: Sequelize.STRING(190), allowNull: true });
    await queryInterface.addIndex('web_lembretes', ['ds_ref'], { name: 'uq_lembrete_ref', unique: true });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('web_lembretes', 'uq_lembrete_ref');
    await queryInterface.removeColumn('web_lembretes', 'ds_ref');
    await queryInterface.removeColumn('web_lembretes', 'ds_titulo');
    await queryInterface.removeColumn('web_lembretes', 'mob_animais_id');
    await queryInterface.removeColumn('web_lembretes', 'web_veterinarios_id');
    await queryInterface.removeColumn('web_lembretes', 'tp_origem');
    await queryInterface.changeColumn('web_lembretes', 'web_agendamentos_id', { type: Sequelize.INTEGER, allowNull: false });
  },
};
