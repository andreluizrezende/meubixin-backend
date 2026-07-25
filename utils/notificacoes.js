'use strict';
/*
 * Camada de envio de notificações (e-mail + WhatsApp), compartilhada entre a
 * agenda (lembretes) e outras features. Reaproveita o SMTP e a API de WhatsApp
 * já usados em routes/conferencias.
 */
const nodemailer = require('nodemailer');
const axios = require('axios');

const SMTP = {
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === '1',
  user: process.env.SMTP_USER || 'suporte@cicatribio.com.br',
  pass: process.env.SMTP_PASS || '$up@Rt3ApP',
  from: process.env.SMTP_FROM || '"Meu Bixin" <suporte@cicatribio.com.br>',
};
const WHATSAPP_API_URL =
  process.env.WHATSAPP_API_URL || 'https://coral-app-f97ui.ondigitalocean.app/send-message';

const createTransporter = () =>
  nodemailer.createTransport({
    host: SMTP.host,
    port: SMTP.port,
    secure: SMTP.secure,
    auth: { user: SMTP.user, pass: SMTP.pass },
    tls: { rejectUnauthorized: false },
  });

// Envia um e-mail. Retorna true/false (não lança) para não quebrar o chamador.
async function enviarEmail({ para, assunto, html, texto }) {
  try {
    if (!para) return false;
    const transporter = createTransporter();
    await transporter.sendMail({ from: SMTP.from, to: para, subject: assunto, html, text: texto });
    return true;
  } catch (err) {
    console.error('[notificacoes] erro ao enviar e-mail:', err.message);
    return false;
  }
}

// Normaliza número BR para o formato da API do WhatsApp (DDI 55 + DDD + 8 dígitos,
// removendo o 9 do celular — mesma regra usada em conferencias).
function formatarNumeroWhats(telefone) {
  let n = String(telefone || '').replace(/\D/g, '');
  if (n.length === 11 && n[2] === '9') n = n.substring(0, 2) + n.substring(3);
  if (!n.startsWith('55')) n = '55' + n;
  if (n.length === 13 && n[4] === '9') n = n.substring(0, 4) + n.substring(5);
  return n;
}

// Envia uma mensagem de WhatsApp. Retorna true/false (não lança).
async function enviarWhatsApp({ telefone, texto }) {
  try {
    if (!telefone) return false;
    const to = `${formatarNumeroWhats(telefone)}@s.whatsapp.net`;
    const resp = await axios.post(
      WHATSAPP_API_URL,
      { to, message: texto },
      { headers: { 'Content-Type': 'application/json' }, timeout: 20000 }
    );
    return resp.status >= 200 && resp.status < 300;
  } catch (err) {
    console.error('[notificacoes] erro ao enviar WhatsApp:', err.message);
    return false;
  }
}

module.exports = { enviarEmail, enviarWhatsApp, formatarNumeroWhats };
