'use strict';

/** @type {import('sequelize-cli').Migration} */
// Base comum dos ATESTADOS (Resolução CFMV 1.321/2020): o conteúdo mínimo exige
// endereço do profissional e identificação do estabelecimento — nada disso existia
// no banco. Vale também para o "Grupo B" pendente da Receita, que precisa do mesmo
// endereço do MV.
//
// O estabelecimento entra aqui (e não numa tabela web_clinicas) porque hoje o
// sistema modela UM veterinário por conta: a clínica é 1:1 com o vet (o perfil já
// tem "Logo da Clínica/Consultório"). Se um dia houver clínica com vários MVs,
// extrair estes 3 campos para web_clinicas e apontar por FK.
module.exports = {
  async up(queryInterface, Sequelize) {
    const colunas = {
      // Endereço profissional
      ds_logradouro: { type: Sequelize.STRING(255), allowNull: true },
      nu_numero: { type: Sequelize.STRING(20), allowNull: true }, // string: aceita "s/n"
      ds_complemento: { type: Sequelize.STRING(120), allowNull: true },
      ds_bairro: { type: Sequelize.STRING(120), allowNull: true },
      ds_cidade: { type: Sequelize.STRING(120), allowNull: true },
      ds_uf: { type: Sequelize.STRING(2), allowNull: true },
      nu_cep: { type: Sequelize.STRING(9), allowNull: true }, // com máscara: 00000-000
      // Identificação do estabelecimento
      ds_clinica_nome: { type: Sequelize.STRING(255), allowNull: true },
      nu_clinica_cnpj: { type: Sequelize.STRING(18), allowNull: true }, // 00.000.000/0000-00
      nu_clinica_crmv_pj: { type: Sequelize.STRING(30), allowNull: true },
    };
    for (const [nome, def] of Object.entries(colunas)) {
      await queryInterface.addColumn('web_veterinarios', nome, def);
    }
  },

  async down(queryInterface) {
    const nomes = [
      'ds_logradouro', 'nu_numero', 'ds_complemento', 'ds_bairro', 'ds_cidade',
      'ds_uf', 'nu_cep', 'ds_clinica_nome', 'nu_clinica_cnpj', 'nu_clinica_crmv_pj',
    ];
    for (const nome of nomes) {
      await queryInterface.removeColumn('web_veterinarios', nome);
    }
  },
};
