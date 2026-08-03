'use strict';

/*
 * Recuperação de senha do app — código de uso único.
 *
 * ⚠️ NÃO altera nenhuma tabela `mob_*`. É tabela nova, prefixo `mol_` (mobile),
 * seguindo o precedente de `mol_responsavel_sessao`.
 *
 * A FK aponta para `mob_usuarios` mas com ON DELETE CASCADE — apagar o usuário
 * leva junto os pedidos de reset dele, que não fazem sentido órfãos.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mol_senha_reset', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      mob_usuarios_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'mob_usuarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      codigo_hash: { type: Sequelize.STRING(64), allowNull: false },
      canal: { type: Sequelize.STRING(15), allowNull: true },
      dt_expira: { type: Sequelize.DATE, allowNull: false },
      usado_em: { type: Sequelize.DATE, allowNull: true },
      tentativas: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      ip: { type: Sequelize.STRING(60), allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    // A consulta quente é "pedido ativo deste usuário": id + validade.
    await queryInterface.addIndex('mol_senha_reset', ['mob_usuarios_id', 'dt_expira'], {
      name: 'idx_senha_reset_usuario_validade',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('mol_senha_reset');
  },
};
