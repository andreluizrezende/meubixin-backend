'use strict';
const { Model } = require('sequelize');

/*
 * Recuperação de senha do APP (mob_usuarios) — código de uso único.
 *
 * Espelha o desenho de `mol_responsavel_sessao` (OTP do Portal) e o de
 * `web_password_reset_token` (reset do vet): o que trafega é um código; o banco
 * guarda só o HASH dele. Assim, vazar esta tabela não dá acesso a conta nenhuma.
 *
 * Por que uma tabela e não um JWT sem estado: com registro dá para ter
 * **uso único**, **contagem de tentativas** (o código tem 6 dígitos e sem isso
 * seria força-bruta trivial) e **invalidação dos anteriores**. Nada disso é
 * possível num token stateless.
 *
 * Prefixo `mol_` pela convenção do mobile — nenhuma tabela `mob_*` foi alterada.
 */
module.exports = (sequelize, DataTypes) => {
  class MolSenhaReset extends Model {}
  MolSenhaReset.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      mob_usuarios_id: { type: DataTypes.INTEGER, allowNull: false },
      // SHA-256 do código de 6 dígitos. Nunca o código em si.
      codigo_hash: { type: DataTypes.STRING(64), allowNull: false },
      canal: { type: DataTypes.STRING(15), allowNull: true }, // email | whatsapp
      dt_expira: { type: DataTypes.DATE, allowNull: false },
      usado_em: { type: DataTypes.DATE, allowNull: true },
      // Trava de força-bruta: 6 dígitos são 1 milhão de combinações.
      tentativas: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      ip: { type: DataTypes.STRING(60), allowNull: true },
    },
    {
      sequelize,
      modelName: 'MolSenhaReset',
      tableName: 'mol_senha_reset',
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    }
  );
  return MolSenhaReset;
};
