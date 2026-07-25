'use strict';

/** @type {import('sequelize-cli').Migration} */
// Fila/log de lembretes automáticos da agenda (Fase 2). Cada linha é um envio a
// ser feito num canal (email/whatsapp) num horário (dt_agendado_para). O motor
// (POST /agenda/lembretes/processar) processa as pendentes vencidas.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('web_lembretes', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      web_agendamentos_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'web_agendamentos', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      tp_lembrete: { type: Sequelize.STRING(20), allowNull: false }, // lembrete_24h | lembrete_2h | confirmacao | retorno
      canal: { type: Sequelize.STRING(15), allowNull: false }, // email | whatsapp
      dt_agendado_para: { type: Sequelize.DATE, allowNull: false },
      dt_enviado: { type: Sequelize.DATE, allowNull: true },
      st_status: { type: Sequelize.STRING(15), allowNull: false, defaultValue: 'pendente' }, // pendente | enviando | enviado | erro | cancelado
      ds_erro: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    // Índice para a query do motor (pendentes vencidas).
    await queryInterface.addIndex('web_lembretes', ['st_status', 'dt_agendado_para'], {
      name: 'idx_lembrete_status_data',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('web_lembretes');
  },
};
