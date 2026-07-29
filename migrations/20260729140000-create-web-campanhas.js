'use strict';

/** @type {import('sequelize-cli').Migration} */
// Definição das campanhas criadas pelo vet. Até aqui a campanha personalizada
// não existia como registro: `criarCampanhaCustom` só gravava as LINHAS DE ENVIO
// em web_campanha_envios, repetindo nome/descrição em cada linha. Sem uma
// definição não dá para listar as campanhas do vet nem apagar uma delas — que é
// justamente o que separa a campanha criada por ele dos 4 gatilhos FIXOS
// (inativo, aniversário, check-up sênior, pós-atendimento), que vivem em código
// e não podem ser apagados.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('web_campanhas', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      web_veterinarios_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'web_veterinarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      ds_nome: { type: Sequelize.STRING(255), allowNull: false },
      ds_descricao: { type: Sequelize.TEXT, allowNull: true },
      ds_mensagem: { type: Sequelize.TEXT, allowNull: true },
      // Filtros do público em JSON, para exibir na tela o que a campanha recorta.
      ds_filtros: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('web_campanhas', ['web_veterinarios_id'], {
      name: 'idx_web_campanhas_vet',
    });

    // Liga o envio à campanha que o gerou. Nulo nos envios dos gatilhos fixos e
    // nos envios antigos, criados antes desta tabela existir.
    await queryInterface.addColumn('web_campanha_envios', 'web_campanhas_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'web_campanhas', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('web_campanha_envios', 'web_campanhas_id');
    await queryInterface.dropTable('web_campanhas');
  },
};
