'use strict';
// Emissão + envio do acesso SEM SENHA do Portal do Responsável (OTP + link mágico).
// Compartilhado entre a rota pública (responsável pede o próprio acesso) e a rota
// autenticada do vet ("Abrir portal" na Agenda). Cria a linha em
// mol_responsavel_sessao e envia pelo canal escolhido (best-effort).
const crypto = require('crypto');
const models = require('../models');
const { MolResponsavelSessao } = models;
const { enviarEmail, enviarWhatsApp } = require('./notificacoes');

const APP_URL = process.env.WEB_APP_URL || process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000';
const OTP_MIN = 15;

const gerarCodigo = () => String(Math.floor(100000 + Math.random() * 900000));
const gerarToken = () => crypto.randomBytes(24).toString('hex');

// Cria (ou reaproveita, se < 60s) um acesso e envia. `tutor` = { id, no_completo,
// ds_email, nu_telefone_completo }. `canal`: 'whatsapp' | 'email' | 'auto'.
// Retorna { canal, enviado } — não lança se o envio falhar (apenas loga).
async function emitirEnviarAcesso({ tutor, canal = 'auto', ip, userAgent }) {
  if (!tutor || !tutor.id) throw new Error('tutor inválido');
  const temTel = !!tutor.nu_telefone_completo;
  const temEmail = !!tutor.ds_email;
  const canalFinal = canal === 'auto' ? (temTel ? 'whatsapp' : 'email') : canal;

  // reusa código emitido há < 60s (anti-spam), senão cria novo.
  const recente = await MolResponsavelSessao.findOne({
    where: { mob_tutores_id: tutor.id, usado_em: null },
    order: [['createdAt', 'DESC']],
  });
  let codigo, token;
  if (recente && Date.now() - new Date(recente.createdAt).getTime() < 60000) {
    codigo = recente.codigo; token = recente.token;
  } else {
    codigo = gerarCodigo(); token = gerarToken();
    await MolResponsavelSessao.create({
      mob_tutores_id: tutor.id, codigo, token, canal: canalFinal,
      dt_expira: new Date(Date.now() + OTP_MIN * 60000),
      ip: ip || null, user_agent: String(userAgent || '').slice(0, 255) || null,
    });
  }

  const link = `${APP_URL}/portal/entrar?t=${token}`;
  const primeiroNome = String(tutor.no_completo || 'Responsável').split(' ')[0];
  let enviado = false;
  try {
    if (canalFinal === 'whatsapp' && temTel) {
      await enviarWhatsApp({
        telefone: tutor.nu_telefone_completo,
        texto: `Olá, ${primeiroNome}! 🐾\nSeu acesso ao Portal Meu Bixin:\nCódigo *${codigo}* (válido por ${OTP_MIN} min).\nOu abra direto: ${link}`,
      });
      enviado = true;
    } else if (temEmail) {
      await enviarEmail({
        para: tutor.ds_email,
        assunto: 'Seu acesso ao Portal — Meu Bixin',
        html: `<p>Olá, ${primeiroNome}!</p><p>Seu código de acesso é <b style="font-size:20px">${codigo}</b> (válido por ${OTP_MIN} min).</p><p>Ou entre direto: <a href="${link}">abrir o portal</a>.</p>`,
        texto: `Olá, ${primeiroNome}! Seu código de acesso é ${codigo} (válido por ${OTP_MIN} min). Ou acesse: ${link}`,
      });
      enviado = true;
    }
  } catch (e) {
    console.error('[portalAcesso] envio falhou:', e.message);
  }
  return { canal: canalFinal, enviado };
}

module.exports = { emitirEnviarAcesso };
