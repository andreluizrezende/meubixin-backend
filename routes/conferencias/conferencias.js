const express = require('express');
const route = express.Router();
const models = require('../../models');
const { WebConferencias } = models;
const nodemailer = require('nodemailer');
const axios = require('axios');

const createTransporter = () => nodemailer.createTransport({
  host: 'smtp.hostinger.com',
  port: 587,
  secure: false,
  auth: {
    user: 'suporte@cicatribio.com.br',
    pass: '$up@Rt3ApP',
  },
  tls: { rejectUnauthorized: false },
});

function gerarRoomName(nomeAnimal) {
  const nomeSeguro = nomeAnimal
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  return `consulta-${nomeSeguro}-${Date.now()}`;
}

async function enviarEmailTutor({ emailTutor, nomeAnimal, link, nomeVet }) {
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: '"Meu Bixin" <suporte@cicatribio.com.br>',
      to: emailTutor,
      subject: `Consulta online para ${nomeAnimal} — acesse aqui`,
      html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Consulta Online - Meu Bixin</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #8BC34A 0%, #6a9e2f 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .header p { margin: 5px 0 0 0; opacity: 0.9; font-size: 14px; }
    .content { padding: 30px 20px; }
    .greeting { font-size: 18px; margin-bottom: 20px; color: #2c3e50; }
    .message { margin-bottom: 20px; line-height: 1.7; color: #555; }
    .button-container { text-align: center; margin: 30px 0; }
    .join-button { display: inline-block; background: linear-gradient(135deg, #8BC34A 0%, #6a9e2f 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 25px; font-weight: 600; font-size: 16px; box-shadow: 0 3px 10px rgba(139,195,74,0.3); }
    .link-box { background-color: #f8f9fa; border-left: 4px solid #8BC34A; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0; word-break: break-all; font-size: 13px; color: #555; }
    .footer { background-color: #2c3e50; color: #ecf0f1; padding: 20px; text-align: center; font-size: 14px; }
    .footer a { color: #8BC34A; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📹 Consulta Online</h1>
      <p>Meu Bixin</p>
    </div>
    <div class="content">
      <div class="greeting">Olá, tutor(a) de <strong>${nomeAnimal}</strong>!</div>
      <div class="message">
        O Dr(a). <strong>${nomeVet}</strong> está aguardando você em uma videochamada para consultar <strong>${nomeAnimal}</strong>.
      </div>
      <div class="message">
        Clique no botão abaixo para entrar. <strong>Não é necessário criar conta nem instalar nada</strong> — funciona direto no navegador.
      </div>
      <div class="button-container">
        <a href="${link}" class="join-button" style="color: white;">📹 Entrar na Videochamada</a>
      </div>
      <div class="message">Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</div>
      <div class="link-box">
        <a href="${link}" style="color: #8BC34A;">${link}</a>
      </div>
      <div class="message" style="color: #888; font-size: 13px;">
        Em caso de dúvidas, entre em contato com a clínica pelo email
        <a href="mailto:suporte@cicatribio.com.br" style="color: #8BC34A;">suporte@cicatribio.com.br</a>
      </div>
    </div>
    <div class="footer">
      <p>
        <strong>Meu Bixin</strong><br>
        Sistema de Gestão Veterinária<br>
        <a href="mailto:suporte@cicatribio.com.br">suporte@cicatribio.com.br</a>
      </p>
      <p style="margin-top: 15px; opacity: 0.7; font-size: 12px;">
        Este é um email automático, não responda a esta mensagem.
      </p>
    </div>
  </div>
</body>
</html>`,
      text: `Olá, tutor(a) de ${nomeAnimal}!\n\nO Dr(a). ${nomeVet} está aguardando você em uma videochamada.\n\nAcesse pelo link abaixo (não precisa instalar nada):\n${link}\n\nEm caso de dúvidas: suporte@cicatribio.com.br`.trim()
    });
    return true;
  } catch (error) {
    console.error('Erro ao enviar email de conferência:', error.message);
    return false;
  }
}

async function enviarWhatsAppTutor({ telefone, nomeAnimal, link, nomeVet }) {
  try {
    let numeroFormatado = telefone.replace(/\D/g, '');

    // sem DDI: 11 dígitos (DDD + 9 + 8) → remove o 9 e prepende 55
    if (numeroFormatado.length === 11 && numeroFormatado[2] === '9') {
      numeroFormatado = numeroFormatado.substring(0, 2) + numeroFormatado.substring(3);
    }

    if (!numeroFormatado.startsWith('55')) {
      numeroFormatado = '55' + numeroFormatado;
    }

    // com DDI: 13 dígitos (55 + DDD + 9 + 8) → remove o 9
    if (numeroFormatado.length === 13 && numeroFormatado[4] === '9') {
      numeroFormatado = numeroFormatado.substring(0, 4) + numeroFormatado.substring(5);
    }

    const toNumber = `${numeroFormatado}@s.whatsapp.net`;

    const message = `📹 *Consulta Online - Meu Bixin*

Olá, tutor(a) de *${nomeAnimal}*!

O(a) Dr(a). *${nomeVet}* está aguardando você em uma videochamada para consultar *${nomeAnimal}*.

🔗 *Acesse pelo link abaixo (não precisa instalar nada):*
${link}

✅ Funciona direto no navegador, é só clicar!

Em caso de dúvidas: suporte@cicatribio.com.br

---
*Meu Bixin*`;

    await axios.post(
      'https://coral-app-f97ui.ondigitalocean.app/send-message',
      { to: toNumber, message },
      { headers: { 'Content-Type': 'application/json' } }
    );

    console.log(`✅ WhatsApp de conferência enviado para: ${toNumber}`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar WhatsApp de conferência:', error.message);
    return false;
  }
}

// POST /conferencias
route.post('/conferencias', async (req, res) => {
  try {
    const { web_veterinarios_id, mob_animais_id, nome_animal, email_tutor, nome_vet, nu_telefone_completo } = req.body;

    if (!web_veterinarios_id || !mob_animais_id || !nome_animal || !email_tutor) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: web_veterinarios_id, mob_animais_id, nome_animal, email_tutor'
      });
    }

    const roomName = gerarRoomName(nome_animal);
    const link = `https://meet.jit.si/${roomName}`;

    const conferencia = await WebConferencias.create({
      web_veterinarios_id,
      mob_animais_id,
      ds_room_name: roomName,
      ds_link: link,
      ds_email_tutor: email_tutor,
      ds_status: 'agendada',
      dt_conferencia: new Date()
    });

    const emailEnviado = await enviarEmailTutor({
      emailTutor: email_tutor,
      nomeAnimal: nome_animal,
      link,
      nomeVet: nome_vet || 'Veterinário'
    });

    let whatsappEnviado = false;
    if (nu_telefone_completo) {
      whatsappEnviado = await enviarWhatsAppTutor({
        telefone: nu_telefone_completo,
        nomeAnimal: nome_animal,
        link,
        nomeVet: nome_vet || 'Veterinário'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Conferência criada com sucesso',
      data: { id: conferencia.id, link, email_enviado: emailEnviado, whatsapp_enviado: whatsappEnviado }
    });

  } catch (error) {
    console.error('ERRO em POST /conferencias:', error.message);
    res.status(500).json({ success: false, message: 'Erro interno ao criar conferência', error: error.message });
  }
});

// GET /conferencias/animal/:animalId
route.get('/conferencias/animal/:animalId', async (req, res) => {
  try {
    const { animalId } = req.params;

    const conferencias = await WebConferencias.findAll({
      where: { mob_animais_id: animalId },
      order: [['dt_conferencia', 'DESC']]
    });

    res.json(
      conferencias.map(c => ({
        id: c.id,
        animal_id: c.mob_animais_id,
        dt_data: c.dt_conferencia,
        link: c.ds_link,
        email_tutor: c.ds_email_tutor,
        status: c.ds_status,
        ds_anotacoes: c.ds_anotacoes || null
      }))
    );

  } catch (error) {
    console.error('ERRO em GET /conferencias/animal/:animalId:', error.message);
    res.status(500).json({ success: false, message: 'Erro ao buscar conferências', error: error.message });
  }
});

// POST /conferencias/:id/whatsapp
route.post('/conferencias/:id/whatsapp', async (req, res) => {
  try {
    const { id } = req.params;
    const { nu_telefone_completo } = req.body;

    if (!nu_telefone_completo) {
      return res.status(400).json({ success: false, message: 'nu_telefone_completo é obrigatório' });
    }

    const conferencia = await WebConferencias.findByPk(id);
    if (!conferencia) {
      return res.status(404).json({ success: false, message: 'Conferência não encontrada' });
    }

    await enviarWhatsAppTutor({
      telefone: nu_telefone_completo,
      nomeAnimal: 'seu animal',
      link: conferencia.ds_link,
      nomeVet: 'Veterinário'
    });

    res.json({ success: true, message: 'WhatsApp enviado com sucesso' });

  } catch (error) {
    console.error('ERRO em POST /conferencias/:id/whatsapp:', error.message);
    res.status(500).json({ success: false, message: 'Erro ao enviar WhatsApp', error: error.message });
  }
});

// PUT /conferencias/:id/status
route.put('/conferencias/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { ds_status } = req.body;

    const statusValidos = ['agendada', 'realizada', 'cancelada'];
    if (!statusValidos.includes(ds_status)) {
      return res.status(400).json({ success: false, message: `Status inválido. Use: ${statusValidos.join(', ')}` });
    }

    const resposta = await WebConferencias.update({ ds_status }, { where: { id } });

    resposta[0]
      ? res.json({ success: true })
      : res.status(404).json({ success: false, message: 'Conferência não encontrada' });

  } catch (error) {
    console.error('ERRO em PUT /conferencias/:id/status:', error.message);
    res.status(500).json({ success: false, message: 'Erro ao atualizar status', error: error.message });
  }
});

// PUT /conferencias/:id/anotacoes
route.put('/conferencias/:id/anotacoes', async (req, res) => {
  try {
    const { id } = req.params;
    const { ds_anotacoes } = req.body;

    const resposta = await WebConferencias.update({ ds_anotacoes }, { where: { id } });

    resposta[0]
      ? res.json({ success: true })
      : res.status(404).json({ success: false, message: 'Conferência não encontrada' });

  } catch (error) {
    console.error('ERRO em PUT /conferencias/:id/anotacoes:', error.message);
    res.status(500).json({ success: false, message: 'Erro ao salvar anotações', error: error.message });
  }
});

module.exports = route;
