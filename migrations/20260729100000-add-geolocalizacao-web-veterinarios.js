'use strict';

/** @type {import('sequelize-cli').Migration} */
// Geolocalização do veterinário — base da busca "veterinários próximos" no app do
// responsável. As coordenadas saem da geocodificação do endereço profissional
// (adicionado na migration 20260728100000) e podem ser ajustadas manualmente.
//
// Formato decimal igual ao já usado em web_parceiros, que é o precedente de geo
// no projeto: DECIMAL(10,8) para latitude e (11,8) para longitude.
//
// ⚠️ st_atende_domicilio é OPT-IN (default 0): só aparece no mapa quem marcar.
// Sem isso o sistema exporia o endereço de todo veterinário cadastrado.
module.exports = {
  async up(queryInterface, Sequelize) {
    const colunas = {
      nu_latitude: { type: Sequelize.DECIMAL(10, 8), allowNull: true },
      nu_longitude: { type: Sequelize.DECIMAL(11, 8), allowNull: true },
      // Quando as coordenadas foram obtidas — permite saber se estão velhas
      // (ex.: o vet mudou de endereço) e reprocessar.
      dt_geocodificado: { type: Sequelize.DATE, allowNull: true },
      st_atende_domicilio: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      nu_raio_km: { type: Sequelize.INTEGER, allowNull: true }, // até onde ele se desloca
    };
    for (const [nome, def] of Object.entries(colunas)) {
      await queryInterface.addColumn('web_veterinarios', nome, def);
    }

    // A busca filtra por opt-in antes de calcular distância — o índice cobre esse
    // primeiro corte, que é o que reduz o conjunto.
    await queryInterface.addIndex('web_veterinarios', ['st_atende_domicilio'], {
      name: 'idx_web_veterinarios_domicilio',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('web_veterinarios', 'idx_web_veterinarios_domicilio');
    for (const nome of ['nu_raio_km', 'st_atende_domicilio', 'dt_geocodificado', 'nu_longitude', 'nu_latitude']) {
      await queryInterface.removeColumn('web_veterinarios', nome);
    }
  },
};
