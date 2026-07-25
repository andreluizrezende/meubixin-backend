'use strict';

/** @type {import('sequelize-cli').Migration} */
// Retenção (Fase B): satélite de mob_animais para atributos que não existem lá e
// não podem ser adicionados (só web_* é alterável). Chaveada por mob_animais_id.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('web_pet_perfil', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      mob_animais_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'mob_animais', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      dt_nascimento: { type: Sequelize.DATEONLY, allowNull: true },
      ds_doencas_cronicas: { type: Sequelize.TEXT, allowNull: true },
      ds_porte: { type: Sequelize.STRING(30), allowNull: true }, // pequeno | medio | grande
      st_castrado: { type: Sequelize.INTEGER, allowNull: true }, // 0/1
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('web_pet_perfil');
  },
};
