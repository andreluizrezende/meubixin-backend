'use strict';

/** @type {import('sequelize-cli').Migration} */
// Retenção (Fase A): consentimento de comunicação por tutor (LGPD). Satélite de
// mob_tutores. Ausência de linha = permitido (soft opt-in); flags 0 = opt-out.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('web_consentimento', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      mob_tutores_id: {
        type: Sequelize.INTEGER, allowNull: false, unique: true,
        references: { model: 'mob_tutores', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      st_email: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      st_whatsapp: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      st_marketing: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 }, // gatilhos não-transacionais
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) { await queryInterface.dropTable('web_consentimento'); },
};
