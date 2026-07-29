'use strict';

/** @type {import('sequelize-cli').Migration} */
// Dados do IMUNOBIOLÓGICO na dose aplicada. Sem eles o atestado de vacinação não
// se sustenta (principalmente antirrábica, onde lote e fabricante são o cerne do
// documento) — web_protocolos_agendas só tinha dt_data_aplicacao e st_concluido.
//
// Uma única migration destrava DOIS documentos: o atestado de vacinação e a
// carteira de vacinação.
//
// web_veterinarios_id = quem APLICOU a dose, que pode não ser quem assina o
// atestado; a norma pede a identificação de quem executou o ato.
module.exports = {
  async up(queryInterface, Sequelize) {
    const colunas = {
      ds_lote: { type: Sequelize.STRING(60), allowNull: true },
      ds_fabricante: { type: Sequelize.STRING(120), allowNull: true },
      dt_validade_vacina: { type: Sequelize.DATEONLY, allowNull: true },
      ds_via_aplicacao: { type: Sequelize.STRING(60), allowNull: true }, // subcutânea, intramuscular...
      web_veterinarios_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'web_veterinarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
    };
    for (const [nome, def] of Object.entries(colunas)) {
      await queryInterface.addColumn('web_protocolos_agendas', nome, def);
    }
  },

  async down(queryInterface) {
    for (const nome of ['web_veterinarios_id', 'ds_via_aplicacao', 'dt_validade_vacina', 'ds_fabricante', 'ds_lote']) {
      await queryInterface.removeColumn('web_protocolos_agendas', nome);
    }
  },
};
