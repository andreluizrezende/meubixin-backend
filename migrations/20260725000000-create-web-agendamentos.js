'use strict';

/** @type {import('sequelize-cli').Migration} */
// Agenda de consultas/retornos/procedimentos do veterinário (Fase 1).
// Os lembretes automáticos (tabela web_lembretes) são da Fase 2.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('web_agendamentos', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      web_veterinarios_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'web_veterinarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      mob_animais_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'mob_animais', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      // consulta | retorno | vacina | procedimento | teleconsulta
      tp_agendamento: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'consulta' },
      dt_inicio: { type: Sequelize.DATE, allowNull: false },
      nu_duracao_min: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 30 },
      ds_titulo: { type: Sequelize.STRING(255), allowNull: true },
      // agendado | confirmado | concluido | cancelado | faltou
      ds_status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'agendado' },
      ds_local: { type: Sequelize.STRING(255), allowNull: true },
      // liga a uma conferência quando for teleconsulta (Jitsi)
      web_conferencias_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'web_conferencias', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      // snapshot de contato do responsável (usado pelos lembretes na Fase 2)
      ds_email_responsavel: { type: Sequelize.STRING(255), allowNull: true },
      nu_telefone_responsavel: { type: Sequelize.STRING(30), allowNull: true },
      ds_observacoes: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    // Índice para a consulta principal da agenda (por vet + intervalo de datas).
    await queryInterface.addIndex('web_agendamentos', ['web_veterinarios_id', 'dt_inicio'], {
      name: 'idx_agenda_vet_data',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('web_agendamentos');
  },
};
