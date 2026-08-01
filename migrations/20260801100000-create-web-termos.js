'use strict';

/** @type {import('sequelize-cli').Migration} */
// Termos de consentimento / ciência (Res. CFMV 1.321/2020, alterada pela
// 1.653/2025). Espelha web_atestados: um registro por documento emitido, e o PDF
// assinado é rastreado em web_registros_prescricoes (polimórfica via tp_origem).
//
// tp_termo:
//   retirada_sem_alta — a 1.653/2025 tornou OBRIGATÓRIO em todo caso de retirada
//                       do animal sem alta médica (antes dependia da gravidade)
//   cirurgico         — consentimento para procedimento cirúrgico
//   anestesico        — consentimento para procedimento anestésico
//   ciencia_risco     — ciência de risco/prognóstico fora de contexto cirúrgico
//
// ⚠️ NÃO confundir com `web_consentimento`, que é consentimento de COMUNICAÇÃO
// (LGPD) do módulo de Retenção. Mesma palavra, propósito totalmente diferente.
//
// Quem assina este documento é o RESPONSÁVEL, não o veterinário (ao contrário de
// atestado e receita). O fluxo decidido é em papel: gera o PDF → responsável
// assina na consulta → o vet sobe o digitalizado. Por isso não há aqui coluna de
// aceite eletrônico; se um dia o Portal do Responsável passar a colher o aceite,
// entra como satélite ou colunas novas (ver docs/claude-web.md).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('web_termos', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      web_veterinarios_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'web_veterinarios', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'RESTRICT',
      },
      mob_animais_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'mob_animais', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'RESTRICT',
      },
      // Consulta de origem (opcional): o termo pode ser avulso.
      web_anamneses_id: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'web_anamneses', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      tp_termo: { type: Sequelize.STRING(30), allowNull: false },

      // Conteúdo compartilhado pelos 4 tipos.
      ds_procedimento: { type: Sequelize.STRING(255), allowNull: true }, // cirúrgico/anestésico
      ds_riscos: { type: Sequelize.TEXT, allowNull: true },              // riscos informados
      ds_texto: { type: Sequelize.TEXT, allowNull: true },               // corpo declaratório (editável)
      ds_observacoes: { type: Sequelize.TEXT, allowNull: true },

      // Exclusivos de retirada_sem_alta: quando o animal foi retirado e em que
      // estado clínico ele estava — é o que documenta que a retirada foi contra
      // orientação. Nullable porque nenhum outro tipo usa.
      dt_retirada: { type: Sequelize.DATE, allowNull: true },
      ds_estado_clinico: { type: Sequelize.TEXT, allowNull: true },

      dt_emissao: { type: Sequelize.DATE, allowNull: false },
      ds_status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'ativo' }, // ativo | cancelado

      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('web_termos', ['web_veterinarios_id', 'mob_animais_id'], {
      name: 'idx_web_termos_vet_animal',
    });
    await queryInterface.addIndex('web_termos', ['tp_termo'], {
      name: 'idx_web_termos_tipo',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('web_termos');
  },
};
