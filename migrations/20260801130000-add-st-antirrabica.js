'use strict';

/** @type {import('sequelize-cli').Migration} */
// Marca de ANTIRRÁBICA. É a única vacina obrigatória por lei e a que o MAPA exige
// comprovada no atestado de saúde para viagem — por isso precisa ser identificável
// pelo sistema, não só pelo nome que o vet digitou.
//
// TRÊS tabelas, e o motivo de cada uma:
//   web_protocolos_saude       catálogo interno (combobox da prescrição)
//   web_produtos_veterinarios  catálogo de produtos (aba Vacinas)
//   web_protocolos             ⚠️ a PRESCRIÇÃO em si — e este é o essencial.
//
// Por que desnormalizar em web_protocolos: a aba Vacinas grava `nome_protocolo`
// como texto livre vindo do catálogo de produtos e deixa `web_protocolos_saude_id`
// NULO. Um JOIN no catálogo, portanto, não acharia nada para as prescrições novas
// — exatamente o problema que fez `nome_protocolo` e `st_uso_humano` virarem
// colunas próprias (migration 20260723170000). Mesmo padrão aqui: a prescrição
// carimba o que era verdade no momento da prescrição e fica autocontida.
//
// O UPDATE abaixo marca o que já existe, casando por nome. É best-effort e
// deliberadamente amplo (LIKE em vez de igualdade): errar marcando de menos deixa
// o vet sem o bloco no atestado de viagem; o checkbox na tela permite corrigir.
module.exports = {
  async up(queryInterface, Sequelize) {
    const col = { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false };

    await queryInterface.addColumn('web_protocolos_saude', 'st_antirrabica', col);
    await queryInterface.addColumn('web_produtos_veterinarios', 'st_antirrabica', col);
    await queryInterface.addColumn('web_protocolos', 'st_antirrabica', col);

    // Marca as conhecidas. A maioria das collations do MySQL é accent-insensitive,
    // então '%rabic%' também casa 'rábic' — as variações estão listadas assim
    // mesmo para não depender disso.
    const casaAntirrabica = (coluna) => `
      ${coluna} LIKE '%antirrabic%' OR ${coluna} LIKE '%antirrábic%'
      OR ${coluna} LIKE '%anti-rabic%' OR ${coluna} LIKE '%anti-rábic%'
      OR ${coluna} LIKE '%raiva%' OR ${coluna} LIKE '%rabica%' OR ${coluna} LIKE '%rábica%'
    `;

    await queryInterface.sequelize.query(
      `UPDATE web_protocolos_saude SET st_antirrabica = 1
        WHERE ${casaAntirrabica('ds_protocolos_saude')}`
    );
    await queryInterface.sequelize.query(
      `UPDATE web_produtos_veterinarios SET st_antirrabica = 1
        WHERE subcategoria = 'Vacina' AND (${casaAntirrabica('nome')})`
    );
    // Prescrições JÁ FEITAS: carimba pelo nome gravado, para o histórico do
    // paciente não ficar sem a marca (é ele que alimenta o atestado de viagem).
    await queryInterface.sequelize.query(
      `UPDATE web_protocolos SET st_antirrabica = 1
        WHERE st_tipo_protocolo = 0 AND nome_protocolo IS NOT NULL
          AND (${casaAntirrabica('nome_protocolo')})`
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('web_protocolos', 'st_antirrabica');
    await queryInterface.removeColumn('web_produtos_veterinarios', 'st_antirrabica');
    await queryInterface.removeColumn('web_protocolos_saude', 'st_antirrabica');
  },
};
