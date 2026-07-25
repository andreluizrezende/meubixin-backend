'use strict';

/** @type {import('sequelize-cli').Migration} */
// Retenção (Fase A): fila/log de envios de gatilhos de retenção (desacoplada de
// web_agendamentos). ds_chave_dedup evita reenviar o mesmo gatilho (unique por vet).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('web_campanha_envios', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      web_veterinarios_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'web_veterinarios', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      mob_animais_id: { type: Sequelize.INTEGER, allowNull: true },
      mob_tutores_id: { type: Sequelize.INTEGER, allowNull: true },
      // vacina_vencendo | inativo | aniversario | checkup_idoso | pos_atendimento
      tp_gatilho: { type: Sequelize.STRING(30), allowNull: false },
      canal: { type: Sequelize.STRING(15), allowNull: false }, // email | whatsapp
      ds_titulo: { type: Sequelize.STRING(255), allowNull: true }, // contexto (ex.: nome da vacina)
      dt_agendado_para: { type: Sequelize.DATE, allowNull: false },
      dt_enviado: { type: Sequelize.DATE, allowNull: true },
      st_status: { type: Sequelize.STRING(15), allowNull: false, defaultValue: 'pendente' },
      ds_erro: { type: Sequelize.TEXT, allowNull: true },
      ds_chave_dedup: { type: Sequelize.STRING(180), allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('web_campanha_envios', ['web_veterinarios_id', 'ds_chave_dedup'], {
      name: 'uq_campanha_dedup', unique: true,
    });
    await queryInterface.addIndex('web_campanha_envios', ['st_status', 'dt_agendado_para'], {
      name: 'idx_campanha_status_data',
    });
  },
  async down(queryInterface) { await queryInterface.dropTable('web_campanha_envios'); },
};
