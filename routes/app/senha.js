'use strict';
/*
 * RECUPERAÇÃO DE SENHA DO APP — fluxo seguro (02/08/2026).
 *
 * Substitui `POST /recuperarSenha` + `PUT /updateSenha` (routes/usuarios/usuarios.js),
 * que tinham defeitos graves — o principal: `/updateSenha` trocava a senha de
 * QUALQUER conta sabendo só CPF + e-mail, sem nenhuma prova de posse. Era
 * takeover em uma requisição.
 *
 *   POST /app/senha/solicitar   { cpf, canal }               → sempre 200
 *   POST /app/senha/redefinir   { cpf, codigo, nova_senha }
 *
 * O desenho espelha o que esta base já usa em dois lugares: o OTP do Portal
 * (`mol_responsavel_sessao`) e o reset do vet (`web_password_reset_token`).
 *
 * Decisões que valem registro:
 * - **quem gera a senha é o usuário**, não o servidor nem o app. Antes, o
 *   CELULAR sorteava a senha com Math.random() e a mandava em texto claro;
 * - o banco guarda o **hash** do código, nunca o código;
 * - **uso único** + **máximo de tentativas**: 6 dígitos são 1 milhão de
 *   combinações, o que sem trava é força-bruta trivial;
 * - a resposta de `solicitar` é **sempre a mesma**, exista o CPF ou não — não
 *   serve para descobrir quem tem cadastro;
 * - a senha só é trocada **depois** de validado o código; se o envio falhar, o
 *   usuário continua com a senha antiga (antes ele ficava trancado fora).
 */
const express = require('express');
const route = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const models = require('../../models');
const { sequelize, MolSenhaReset } = models;
const { enviarEmail, enviarWhatsApp } = require('../../utils/notificacoes');

const usuarios = models.mob_usuarios;

const VALIDADE_MIN = 15;
const MAX_TENTATIVAS = 5;
const SENHA_MIN = 6;

const soDigitos = (v) => String(v || '').replace(/\D/g, '');
const hashCodigo = (codigo) => crypto.createHash('sha256').update(String(codigo)).digest('hex');

// 6 dígitos com CSPRNG. Math.random() não serve para nada que proteja conta.
const gerarCodigo = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

// Resposta única de /solicitar: não revela se o CPF existe nem por onde foi enviado.
const RESPOSTA_NEUTRA = {
  success: true,
  message: 'Se houver cadastro com esses dados, enviamos um código de 6 dígitos. Ele vale por 15 minutos.',
};

async function acharUsuarioPorCpf(cpf) {
  const [linha] = await sequelize.query(
    `SELECT id, no_completo, ds_email, nu_telefone_completo
       FROM mob_usuarios
      WHERE REPLACE(REPLACE(REPLACE(nu_cpf, '.', ''), '-', ''), ' ', '') = :cpf
      LIMIT 1`,
    { replacements: { cpf }, type: sequelize.QueryTypes.SELECT }
  );
  return linha || null;
}

// POST /app/senha/solicitar { cpf, canal: 'email' | 'whatsapp' }
route.post('/app/senha/solicitar', async (req, res) => {
  try {
    const cpf = soDigitos((req.body || {}).cpf);
    const canal = (req.body || {}).canal === 'whatsapp' ? 'whatsapp' : 'email';

    if (!cpf || cpf.length < 11) {
      return res.status(400).json({ success: false, message: 'Informe um CPF válido.' });
    }

    const usuario = await acharUsuarioPorCpf(cpf);

    // ⚠️ Daqui para baixo, QUALQUER caminho responde igual. Um 404 aqui
    // transformaria a rota num verificador de "este CPF tem conta?".
    if (!usuario) return res.json(RESPOSTA_NEUTRA);

    const destino = canal === 'whatsapp' ? usuario.nu_telefone_completo : usuario.ds_email;
    if (!destino) return res.json(RESPOSTA_NEUTRA);

    // Invalida pedidos anteriores: um código ativo por vez.
    await MolSenhaReset.update(
      { usado_em: new Date() },
      { where: { mob_usuarios_id: usuario.id, usado_em: null } }
    );

    const codigo = gerarCodigo();
    await MolSenhaReset.create({
      mob_usuarios_id: usuario.id,
      codigo_hash: hashCodigo(codigo),
      canal,
      dt_expira: new Date(Date.now() + VALIDADE_MIN * 60 * 1000),
      ip: req.ip || null,
    });

    const primeiroNome = String(usuario.no_completo || '').split(' ')[0];
    const texto =
      `Olá, ${primeiroNome}! Seu código para redefinir a senha do Meu Bixin é ${codigo}. ` +
      `Ele vale por ${VALIDADE_MIN} minutos. Se não foi você que pediu, ignore esta mensagem — ` +
      `sua senha continua a mesma.`;

    // Envio best-effort: a resposta não muda se falhar, senão viraria oráculo.
    try {
      if (canal === 'whatsapp') {
        await enviarWhatsApp({ telefone: destino, texto });
      } else {
        await enviarEmail({
          para: destino,
          assunto: 'Meu Bixin — código para redefinir sua senha',
          texto,
          html:
            `<p>Olá, <b>${primeiroNome}</b>!</p>` +
            `<p>Seu código para redefinir a senha do <b>Meu Bixin</b> é:</p>` +
            `<p style="font-size:26px;font-weight:800;letter-spacing:6px">${codigo}</p>` +
            `<p>Ele vale por ${VALIDADE_MIN} minutos.</p>` +
            `<p style="color:#666">Se não foi você que pediu, ignore este e-mail — sua senha continua a mesma.</p>`,
        });
      }
    } catch (e) {
      console.error('falha ao enviar código de senha (%s): %s', canal, e.message);
    }

    // ⚠️ NÃO devolver o destino mascarado, por mais útil que fosse à tela.
    // A resposta precisa ser byte a byte igual à do CPF inexistente; se só o
    // caso "existe" trouxesse a chave `destino`, a rota viraria um verificador
    // de "este CPF tem conta?" — que é justamente o que RESPOSTA_NEUTRA evita.
    return res.json(RESPOSTA_NEUTRA);
  } catch (err) {
    console.error('POST /app/senha/solicitar', err);
    return res.status(500).json({ success: false, message: 'Erro ao solicitar o código.' });
  }
});

// POST /app/senha/redefinir { cpf, codigo, nova_senha }
route.post('/app/senha/redefinir', async (req, res) => {
  try {
    const { codigo, nova_senha } = req.body || {};
    const cpf = soDigitos((req.body || {}).cpf);

    if (!cpf || !codigo) {
      return res.status(400).json({ success: false, message: 'Informe o CPF e o código recebido.' });
    }
    if (!nova_senha || String(nova_senha).length < SENHA_MIN) {
      return res.status(400).json({
        success: false,
        message: `A nova senha deve ter pelo menos ${SENHA_MIN} caracteres.`,
      });
    }

    const usuario = await acharUsuarioPorCpf(cpf);
    // Mensagem genérica de propósito: não distingue "CPF não existe" de
    // "código errado" — as duas são a mesma coisa para quem está tentando.
    const INVALIDO = { success: false, message: 'Código inválido ou expirado. Peça um novo.' };
    if (!usuario) return res.status(400).json(INVALIDO);

    const pedido = await MolSenhaReset.findOne({
      where: {
        mob_usuarios_id: usuario.id,
        usado_em: null,
        dt_expira: { [Op.gt]: new Date() },
      },
      order: [['id', 'DESC']],
    });
    if (!pedido) return res.status(400).json(INVALIDO);

    if (pedido.tentativas >= MAX_TENTATIVAS) {
      // Queima o pedido: obriga a solicitar outro código.
      await pedido.update({ usado_em: new Date() });
      return res.status(429).json({
        success: false,
        message: 'Muitas tentativas. Peça um novo código.',
      });
    }

    // Comparação em tempo constante — evita vazar o código por medida de tempo.
    const enviado = Buffer.from(hashCodigo(soDigitos(codigo)));
    const guardado = Buffer.from(pedido.codigo_hash);
    const confere = enviado.length === guardado.length && crypto.timingSafeEqual(enviado, guardado);

    if (!confere) {
      await pedido.update({ tentativas: pedido.tentativas + 1 });
      return res.status(400).json(INVALIDO);
    }

    // Só aqui a senha muda — e o código morre junto, para não servir duas vezes.
    const hash = await bcrypt.hash(String(nova_senha), 10);
    await usuarios.update({ ds_senha: hash }, { where: { id: usuario.id } });
    await pedido.update({ usado_em: new Date() });

    console.log('senha redefinida para mob_usuarios#%s', usuario.id); // sem a senha, nunca

    return res.json({ success: true, message: 'Senha redefinida. Faça login com a nova senha.' });
  } catch (err) {
    console.error('POST /app/senha/redefinir', err);
    return res.status(500).json({ success: false, message: 'Erro ao redefinir a senha.' });
  }
});

module.exports = route;
