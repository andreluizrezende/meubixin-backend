'use strict';

/** @type {import('sequelize-cli').Migration} */
// IDENTIFICAÇÃO DO ANIMAL exigida pelos anexos da Res. CFMV 1.321/2020 (alterada
// pela 1.653/2025). Os Anexos I (atestado sanitário), II (óbito) e XI (vacinação)
// repetem LITERALMENTE a mesma lista:
//
//   "nome, sexo, raça, idade real ou presumida, cor de pelagem ou plumagem,
//    sinais particulares, tatuagem, brinco, microchip, registro genealógico e,
//    conforme o caso, resenha detalhada"
//
// Já existiam: nome/sexo/pelagem (mob_animais), raça e nascimento
// (web_pet_perfil). Faltavam os 5 últimos + a resenha — é o que entra aqui.
//
// Vai em web_pet_perfil (satélite) porque `mob_animais` NÃO é alterável: só
// tabelas web_* podem ser criadas/alteradas neste sistema.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('web_pet_perfil', 'ds_sinais_particulares', {
      type: Sequelize.TEXT, allowNull: true,
    });
    await queryInterface.addColumn('web_pet_perfil', 'ds_tatuagem', {
      type: Sequelize.STRING(60), allowNull: true,
    });
    // "brinco" no texto da norma = identificação de orelha (usual em produção).
    await queryInterface.addColumn('web_pet_perfil', 'ds_brinco', {
      type: Sequelize.STRING(60), allowNull: true,
    });
    // Microchip: número único e inalterável, lido por leitor específico. String,
    // e não número: pode ter zeros à esquerda e o padrão ISO tem 15 dígitos.
    await queryInterface.addColumn('web_pet_perfil', 'nu_microchip', {
      type: Sequelize.STRING(30), allowNull: true,
    });
    await queryInterface.addColumn('web_pet_perfil', 'ds_registro_genealogico', {
      type: Sequelize.STRING(60), allowNull: true,
    });
    // "conforme o caso": resenha detalhada (descrição de marcas/pelagem), usada
    // sobretudo em equinos.
    await queryInterface.addColumn('web_pet_perfil', 'ds_resenha', {
      type: Sequelize.TEXT, allowNull: true,
    });
  },

  async down(queryInterface) {
    for (const col of [
      'ds_sinais_particulares', 'ds_tatuagem', 'ds_brinco',
      'nu_microchip', 'ds_registro_genealogico', 'ds_resenha',
    ]) {
      await queryInterface.removeColumn('web_pet_perfil', col);
    }
  },
};
