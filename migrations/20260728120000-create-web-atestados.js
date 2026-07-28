'use strict';

/** @type {import('sequelize-cli').Migration} */
// Atestados médico-veterinários (Resolução CFMV 1.321/2020). Um registro por
// documento emitido; o PDF assinado é rastreado em web_registros_prescricoes
// (que virou polimórfica na migration seguinte).
//
// tp_atestado: saude | vacinacao | carteira_vacinacao | obito
//   (carteira de vacinação não é atestado na norma, mas é documento normatizado
//    e compartilha exatamente a mesma mecânica de emissão/assinatura)
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('web_atestados', {
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
      // Consulta de origem (opcional): atestado pode nascer de um atendimento
      // ou ser avulso (ex.: carteira de vacinação pedida no balcão).
      web_anamneses_id: {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'web_anamneses', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      tp_atestado: { type: Sequelize.STRING(30), allowNull: false },
      ds_finalidade: { type: Sequelize.STRING(255), allowNull: true }, // ex.: "transporte aéreo nacional"
      ds_texto: { type: Sequelize.TEXT, allowNull: true },             // corpo declaratório (editável)
      ds_observacoes: { type: Sequelize.TEXT, allowNull: true },
      dt_emissao: { type: Sequelize.DATE, allowNull: false },
      dt_validade: { type: Sequelize.DATE, allowNull: true },          // viagem = 10 dias
      ds_status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'ativo' }, // ativo | cancelado

      // ---- Campos exclusivos do atestado de ÓBITO ----
      // Ficam aqui (nullable) por serem o CONTEÚDO do documento; nenhum outro tipo
      // os usa. ⚠️ A decisão de PRODUTO de marcar o pet como falecido (e parar
      // lembretes/retenção) continua pendente — não é resolvida por estas colunas.
      dt_obito: { type: Sequelize.DATE, allowNull: true },
      ds_causa_mortis: { type: Sequelize.TEXT, allowNull: true },
      ds_local_obito: { type: Sequelize.STRING(255), allowNull: true }, // cidade/UF, exigido pela norma
      ds_destino_corpo: { type: Sequelize.STRING(255), allowNull: true },

      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('web_atestados', ['web_veterinarios_id', 'mob_animais_id'], {
      name: 'idx_web_atestados_vet_animal',
    });
    await queryInterface.addIndex('web_atestados', ['tp_atestado'], {
      name: 'idx_web_atestados_tipo',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('web_atestados');
  },
};
