'use strict';

/** @type {import('sequelize-cli').Migration} */
// Terceira origem da assinatura polimórfica: TERMOS (consentimento/ciência).
//
// Nada a fazer com `tp_origem`: ele é STRING(20), não ENUM, então aceita o valor
// 'termo' sem ALTER — foi justamente para isso que a 20260728120001 o criou como
// string. E `web_anamneses_id` já ficou NULL naquela migration.
//
// Só falta a FK própria, para o registro apontar para o termo.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('web_registros_prescricoes', 'web_termos_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'web_termos', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE', // apagar o termo apaga o rastro do PDF dele
    });

    await queryInterface.addIndex('web_registros_prescricoes', ['tp_origem', 'web_termos_id'], {
      name: 'idx_registros_origem_termo',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('web_registros_prescricoes', 'idx_registros_origem_termo');
    await queryInterface.removeColumn('web_registros_prescricoes', 'web_termos_id');
  },
};
