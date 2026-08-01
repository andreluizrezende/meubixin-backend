'use strict';

/** @type {import('sequelize-cli').Migration} */
// Anexo de LAUDOS ao prontuário.
//
// A Res. CFMV 1.321/2020, alterada pela 1.653/2025, passou a exigir no prontuário
// "cópia impressa ou digitalizada de cada laudo de exame laboratorial ou de
// imagem". Até aqui só existia `web_anamneses.ds_resultados_exames_anteriores`,
// um STRING(255) de texto livre — não cabe laudo nenhum, e cópia de documento não
// é o mesmo que resumo digitado.
//
// Espelha `web_cobranca_anexos` (mesmo trio nome_original/s3_key/content_type),
// que já resolve upload e URL assinada — nada de mecânica nova.
//
// ON DELETE CASCADE: o laudo pertence à consulta. Se a consulta for apagada, o
// anexo perde o dono e não deve ficar órfão apontando para um S3 que ninguém
// alcança. ⚠️ A guarda de 5 anos exigida pela norma NÃO é resolvida aqui — não há
// política de retenção no sistema; continua na lista de lacunas.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('web_anamnese_anexos', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      web_anamneses_id: {
        type: Sequelize.INTEGER, allowNull: false,
        references: { model: 'web_anamneses', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      // laboratorial | imagem | outro — a norma cita justamente "laboratorial ou
      // de imagem"; `outro` evita que o vet fique sem opção para o resto.
      tp_anexo: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'laboratorial' },
      ds_descricao: { type: Sequelize.STRING(255), allowNull: true }, // "Hemograma", "RX tórax"...
      dt_exame: { type: Sequelize.DATEONLY, allowNull: true },        // data do exame, não do upload
      nome_original: { type: Sequelize.STRING(255), allowNull: false },
      s3_key: { type: Sequelize.STRING(255), allowNull: false },
      content_type: { type: Sequelize.STRING(100), allowNull: true },
      tamanho_bytes: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('web_anamnese_anexos', ['web_anamneses_id'], {
      name: 'idx_web_anamnese_anexos_anamnese',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('web_anamnese_anexos');
  },
};
