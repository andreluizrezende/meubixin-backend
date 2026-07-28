'use strict';

/** @type {import('sequelize-cli').Migration} */
// Torna web_registros_prescricoes POLIMÓRFICA (mesmo padrão já aplicado em
// web_lembretes), para que ATESTADOS usem o mesmo motor de assinatura digital +
// código de verificação da receita, em vez de duplicá-lo.
//
// Antes: web_anamneses_id era NOT NULL e a rota pública de verificação fazia
// INNER JOIN em web_anamneses — um atestado não conseguiria nem gravar o
// registro, e se gravasse sumiria da conferência.
//
// tp_origem tem DEFAULT 'prescricao': as linhas existentes continuam válidas
// sem backfill, e quem já grava sem informar o campo segue funcionando.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('web_registros_prescricoes', 'tp_origem', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'prescricao', // prescricao | atestado
    });

    await queryInterface.addColumn('web_registros_prescricoes', 'web_atestados_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'web_atestados', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE', // apagar o atestado apaga o rastro do PDF dele
    });

    // O passo que destrava tudo: sem isto, um registro de atestado não pode existir.
    // ⚠️ Feito em SQL cru de propósito: o queryInterface.changeColumn NÃO aplicou a
    // nulabilidade nesta tabela (a coluna continuou NOT NULL, silenciosamente, por
    // causa da FK existente). MODIFY só mexe na nulabilidade e preserva a FK.
    await queryInterface.sequelize.query(
      'ALTER TABLE web_registros_prescricoes MODIFY COLUMN web_anamneses_id INT NULL'
    );

    await queryInterface.addIndex('web_registros_prescricoes', ['tp_origem', 'web_atestados_id'], {
      name: 'idx_registros_origem_atestado',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('web_registros_prescricoes', 'idx_registros_origem_atestado');
    await queryInterface.removeColumn('web_registros_prescricoes', 'web_atestados_id');
    await queryInterface.removeColumn('web_registros_prescricoes', 'tp_origem');
    // volta a NOT NULL — só funciona se não houver linha de atestado remanescente
    await queryInterface.sequelize.query(
      'ALTER TABLE web_registros_prescricoes MODIFY COLUMN web_anamneses_id INT NOT NULL'
    );
  },
};
