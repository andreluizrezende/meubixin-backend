'use strict';

const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const axios = require('axios');
const route = express.Router();
const models = require('../../models');
const {
  web_veterinarios: WebVeterinarios,
  WebCobrancas,
  WebCobrancaItens,
  WebPagamentos,
  WebCobrancaAnexos,
  WebAnamneses
} = models;
const requireAuth = require('../../middleware/requireAuth');
const { getStripe, getWebAppUrl } = require('../../utils/stripeClient');
const { uploadToS3, getSignedUrlForDownload, deleteFile } = require('../../utils/s3_teste');

const formatarBRL = (cents) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Cria (ou recria) a Checkout Session Stripe da cobrança, atualizando o status.
// Compartilhado entre a rota de gerar link e os envios por e-mail/WhatsApp.
async function criarLinkCheckout(cobranca, vet) {
  if (!vet.stripe_connect_account_id) {
    return { success: false, message: 'Conecte sua conta Stripe antes de cobrar' };
  }
  if (!vet.stripe_charges_enabled) {
    return { success: false, message: 'Conclua o onboarding da Stripe até habilitar recebimentos' };
  }
  if (cobranca.status === 'paga') {
    return { success: false, message: 'Cobrança já foi paga' };
  }
  if (!cobranca.itens || cobranca.itens.length === 0) {
    return { success: false, message: 'Cobrança sem itens' };
  }

  const stripe = getStripe();
  const web = getWebAppUrl();
  const connectedId = vet.stripe_connect_account_id;

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      client_reference_id: String(cobranca.id),
      customer_email: cobranca.cliente_email || undefined,
      metadata: {
        web_cobrancas_id: String(cobranca.id),
        web_veterinarios_id: String(vet.id)
      },
      success_url: `${web}/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${web}/pagamento/cancelado?cobranca_id=${cobranca.id}`,
      line_items: cobranca.itens.map((it) => ({
        quantity: it.quantidade,
        price_data: {
          currency: cobranca.currency,
          product_data: { name: it.descricao.slice(0, 120) },
          unit_amount: it.valor_unitario_cents
        }
      }))
    },
    { stripeAccount: connectedId }
  );

  await WebCobrancas.update(
    { status: 'pendente_pagamento', stripe_checkout_session_id: session.id },
    { where: { id: cobranca.id } }
  );

  return { success: true, url: session.url };
}

const createMailTransporter = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  tls: { rejectUnauthorized: false }
});

// Envia o link de pagamento por e-mail — mesma lógica/template usados na conferência
// (nodemailer + HTML com botão de ação), adaptados para o contexto de cobrança.
async function enviarEmailCobranca({ emailTutor, clienteNome, descricao, valorFormatado, link, nomeVet }) {
  try {
    const transporter = createMailTransporter();
    const assunto = descricao ? `Cobrança — ${descricao}` : 'Cobrança — link de pagamento';
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Meu Bixin" <${process.env.SMTP_USER}>`,
      to: emailTutor,
      subject: assunto,
      html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cobrança - Meu Bixin</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #8BC34A 0%, #6a9e2f 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .header p { margin: 5px 0 0 0; opacity: 0.9; font-size: 14px; }
    .content { padding: 30px 20px; }
    .greeting { font-size: 18px; margin-bottom: 20px; color: #2c3e50; }
    .message { margin-bottom: 20px; line-height: 1.7; color: #555; }
    .valor-box { background-color: #f8f9fa; border-left: 4px solid #8BC34A; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0; font-size: 22px; font-weight: 700; color: #2c3e50; }
    .button-container { text-align: center; margin: 30px 0; }
    .pay-button { display: inline-block; background: linear-gradient(135deg, #8BC34A 0%, #6a9e2f 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 25px; font-weight: 600; font-size: 16px; box-shadow: 0 3px 10px rgba(139,195,74,0.3); }
    .link-box { background-color: #f8f9fa; border-left: 4px solid #8BC34A; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0; word-break: break-all; font-size: 13px; color: #555; }
    .footer { background-color: #2c3e50; color: #ecf0f1; padding: 20px; text-align: center; font-size: 14px; }
    .footer a { color: #8BC34A; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💳 Cobrança</h1>
      <p>Meu Bixin</p>
    </div>
    <div class="content">
      <div class="greeting">Olá, ${clienteNome}!</div>
      <div class="message">
        O(a) Dr(a). <strong>${nomeVet}</strong> enviou uma cobrança${descricao ? ` referente a <strong>${descricao}</strong>` : ''}.
      </div>
      <div class="valor-box">${valorFormatado}</div>
      <div class="message">
        Clique no botão abaixo para pagar com cartão. <strong>Pagamento processado de forma segura pela Stripe.</strong>
      </div>
      <div class="button-container">
        <a href="${link}" class="pay-button" style="color: white;">💳 Pagar agora</a>
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
      text: `Olá, ${clienteNome}!\n\nO(a) Dr(a). ${nomeVet} enviou uma cobrança${descricao ? ` referente a ${descricao}` : ''} no valor de ${valorFormatado}.\n\nPague pelo link abaixo:\n${link}\n\nEm caso de dúvidas: suporte@cicatribio.com.br`.trim()
    });
    return { ok: true };
  } catch (error) {
    console.error('Erro ao enviar email de cobrança:', error.message);
    return { ok: false, error: error.message };
  }
}

// Envia o link de pagamento por WhatsApp — mesma lógica usada na conferência
// (normalização do número + API externa de envio), adaptada para cobrança.
async function enviarWhatsAppCobranca({ telefone, clienteNome, descricao, valorFormatado, link, nomeVet }) {
  try {
    let numeroFormatado = telefone.replace(/\D/g, '');

    // sem DDI: 11 dígitos (DDD + 9 + 8) → remove o 9
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
    const saudacao = clienteNome ? `Olá, *${clienteNome}*!` : 'Olá!';

    const message = `💳 *Cobrança - Meu Bixin*

${saudacao}

O(a) Dr(a). *${nomeVet}* enviou uma cobrança${descricao ? ` referente a *${descricao}*` : ''} no valor de *${valorFormatado}*.

🔗 *Pague pelo link abaixo:*
${link}

✅ Pagamento processado de forma segura pela Stripe.

Em caso de dúvidas: suporte@cicatribio.com.br

---
*Meu Bixin*`;

    await axios.post(
      'https://coral-app-f97ui.ondigitalocean.app/send-message',
      { to: toNumber, message },
      { headers: { 'Content-Type': 'application/json' } }
    );

    return { ok: true };
  } catch (error) {
    console.error('Erro ao enviar WhatsApp de cobrança:', error.message);
    return { ok: false, error: error.message };
  }
}

// Todas as rotas de cobrança exigem autenticação; a identidade vem do token.
route.use(requireAuth);

// Upload de anexos: imagens e PDF, até 10 MB, em memória.
const ANEXO_TIPOS = ['image/png', 'image/jpg', 'image/jpeg', 'application/pdf'];
const uploadAnexo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ANEXO_TIPOS.includes(file.mimetype))
});

const nomeAnexoUnico = (originalname) => {
  const ext = (originalname && originalname.includes('.')) ? originalname.split('.').pop() : 'bin';
  return `cobrancas/anexos/${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
};

// Normaliza itens recebidos do frontend, ignorando linhas vazias.
function normalizarItens(itens) {
  if (!Array.isArray(itens)) return [];
  return itens
    .map((it, idx) => ({
      descricao: String(it.descricao || '').trim(),
      procedimento: it.procedimento ? String(it.procedimento).trim() : null,
      quantidade: Math.max(1, parseInt(it.quantidade, 10) || 1),
      valor_unitario_cents: Math.max(0, parseInt(it.valor_unitario_cents, 10) || 0),
      ordem: idx
    }))
    .filter((it) => it.descricao && it.valor_unitario_cents > 0);
}

function totalCents(itens) {
  return itens.reduce((acc, it) => acc + it.quantidade * it.valor_unitario_cents, 0);
}

// Sentinela: distingue "não informou consulta" (→ null, vínculo opcional) de
// "informou uma consulta que não é dele" (→ 400).
const INVALIDA = Symbol('consulta-invalida');

// Valida o vínculo opcional cobrança → consulta. Devolve o id, null (sem vínculo)
// ou INVALIDA quando a anamnese não existe / é de outro veterinário.
async function validarConsulta(web_anamneses_id, vetId) {
  if (!web_anamneses_id) return null;
  const id = parseInt(web_anamneses_id, 10);
  if (Number.isNaN(id)) return INVALIDA;
  const anamnese = await WebAnamneses.findOne({
    where: { id, web_veterinarios_id: vetId },
    attributes: ['id']
  });
  return anamnese ? id : INVALIDA;
}

// POST /cobrancas  body: { vetId, cliente_nome, cliente_email?, cliente_documento?, descricao?, itens: [] }
route.post('/cobrancas', async (req, res) => {
  try {
    const { cliente_nome, cliente_email, cliente_documento, descricao, itens, mob_animais_id, web_anamneses_id } = req.body;
    const vet = await WebVeterinarios.findByPk(req.vetId);
    if (!vet) return res.status(404).json({ success: false, message: 'Veterinário não encontrado' });
    if (!cliente_nome || !String(cliente_nome).trim()) {
      return res.status(400).json({ success: false, message: 'Informe o nome do cliente' });
    }

    const itensNorm = normalizarItens(itens);
    if (itensNorm.length === 0) {
      return res.status(400).json({ success: false, message: 'Adicione ao menos um item válido' });
    }

    // Consulta associada (opcional). Confere que a anamnese é DESTE veterinário —
    // o id vem do cliente, então não dá para confiar nele.
    const anamneseId = await validarConsulta(web_anamneses_id, req.vetId);
    if (anamneseId === INVALIDA) {
      return res.status(400).json({ success: false, message: 'Consulta inválida ou de outro veterinário' });
    }

    const cobranca = await WebCobrancas.create({
      web_veterinarios_id: vet.id,
      cliente_nome: String(cliente_nome).trim(),
      cliente_email: cliente_email || null,
      cliente_documento: cliente_documento || null,
      descricao: descricao || null,
      mob_animais_id: mob_animais_id || null,
      web_anamneses_id: anamneseId,
      status: 'rascunho',
      total_cents: totalCents(itensNorm),
      currency: 'brl'
    });

    await WebCobrancaItens.bulkCreate(
      itensNorm.map((it) => ({ ...it, web_cobrancas_id: cobranca.id }))
    );

    const completo = await WebCobrancas.findByPk(cobranca.id, {
      include: [{ model: WebCobrancaItens, as: 'itens' }]
    });
    return res.json({ success: true, cobranca: completo });
  } catch (err) {
    console.error('POST /cobrancas', err);
    return res.status(500).json({ success: false, message: 'Erro ao criar cobrança' });
  }
});

// GET /cobrancas  (lista as cobranças do veterinário autenticado)
route.get('/cobrancas', async (req, res) => {
  try {
    const where = { web_veterinarios_id: req.vetId };
    if (req.query.mob_animais_id) {
      where.mob_animais_id = parseInt(req.query.mob_animais_id, 10);
    }
    const cobrancas = await WebCobrancas.findAll({
      where,
      include: [
        { model: WebCobrancaItens, as: 'itens' },
        { model: WebAnamneses, as: 'consulta', attributes: ['id', 'dt_data_anamnese'], required: false }
      ],
      order: [['createdAt', 'DESC']]
    });
    return res.json({ success: true, cobrancas });
  } catch (err) {
    console.error('GET /cobrancas', err);
    return res.status(500).json({ success: false, message: 'Erro ao listar cobranças' });
  }
});

// GET /cobrancas/:id
route.get('/cobrancas/:id', async (req, res) => {
  try {
    const cobranca = await WebCobrancas.findByPk(req.params.id, {
      include: [
        { model: WebCobrancaItens, as: 'itens' },
        { model: WebPagamentos, as: 'pagamentos' },
        { model: WebCobrancaAnexos, as: 'anexos' },
        { model: WebAnamneses, as: 'consulta', attributes: ['id', 'dt_data_anamnese'], required: false }
      ]
    });
    if (!cobranca) return res.status(404).json({ success: false, message: 'Cobrança não encontrada' });
    if (Number(cobranca.web_veterinarios_id) !== req.vetId) {
      return res.status(403).json({ success: false, message: 'Cobrança não pertence a este veterinário' });
    }
    return res.json({ success: true, cobranca });
  } catch (err) {
    console.error('GET /cobrancas/:id', err);
    return res.status(500).json({ success: false, message: 'Erro ao buscar cobrança' });
  }
});

// POST /cobrancas/:id/checkout  body: { vetId }
// Gera o link de pagamento (Checkout Session) na conta Connect do veterinário.
route.post('/cobrancas/:id/checkout', async (req, res) => {
  try {
    const cobranca = await WebCobrancas.findByPk(req.params.id, {
      include: [{ model: WebCobrancaItens, as: 'itens' }]
    });
    if (!cobranca) return res.status(404).json({ success: false, message: 'Cobrança não encontrada' });
    if (Number(cobranca.web_veterinarios_id) !== req.vetId) {
      return res.status(403).json({ success: false, message: 'Cobrança não pertence a este veterinário' });
    }

    const vet = await WebVeterinarios.findByPk(cobranca.web_veterinarios_id);
    if (!vet) return res.status(404).json({ success: false, message: 'Veterinário não encontrado' });

    const resultado = await criarLinkCheckout(cobranca, vet);
    if (!resultado.success) return res.status(400).json(resultado);
    return res.json(resultado);
  } catch (err) {
    console.error('POST /cobrancas/:id/checkout', err);
    return res.status(500).json({ success: false, message: `Erro ao gerar link de pagamento: ${err.message}` });
  }
});

// POST /cobrancas/:id/email
// Gera (ou renova) o link de pagamento e envia por e-mail ao cliente da cobrança.
route.post('/cobrancas/:id/email', async (req, res) => {
  try {
    const cobranca = await WebCobrancas.findByPk(req.params.id, {
      include: [{ model: WebCobrancaItens, as: 'itens' }]
    });
    if (!cobranca) return res.status(404).json({ success: false, message: 'Cobrança não encontrada' });
    if (Number(cobranca.web_veterinarios_id) !== req.vetId) {
      return res.status(403).json({ success: false, message: 'Cobrança não pertence a este veterinário' });
    }
    if (!cobranca.cliente_email) {
      return res.status(400).json({ success: false, message: 'Cobrança sem e-mail do cliente' });
    }

    const vet = await WebVeterinarios.findByPk(cobranca.web_veterinarios_id);
    if (!vet) return res.status(404).json({ success: false, message: 'Veterinário não encontrado' });

    const linkResultado = await criarLinkCheckout(cobranca, vet);
    if (!linkResultado.success) return res.status(400).json(linkResultado);

    const resultadoEnvio = await enviarEmailCobranca({
      emailTutor: cobranca.cliente_email,
      clienteNome: cobranca.cliente_nome,
      descricao: cobranca.descricao,
      valorFormatado: formatarBRL(cobranca.total_cents),
      link: linkResultado.url,
      nomeVet: vet.no_completo || 'Veterinário'
    });

    if (!resultadoEnvio.ok) {
      return res.status(500).json({
        success: false,
        message: `Não foi possível enviar o e-mail: ${resultadoEnvio.error || 'motivo desconhecido'}`
      });
    }
    return res.json({ success: true, message: 'E-mail enviado com sucesso', url: linkResultado.url });
  } catch (err) {
    console.error('POST /cobrancas/:id/email', err);
    return res.status(500).json({ success: false, message: `Erro ao enviar e-mail: ${err.message}` });
  }
});

// POST /cobrancas/:id/whatsapp  body: { nu_telefone_completo }
// Gera (ou renova) o link de pagamento e envia por WhatsApp ao número informado.
route.post('/cobrancas/:id/whatsapp', async (req, res) => {
  try {
    const { nu_telefone_completo } = req.body;
    if (!nu_telefone_completo) {
      return res.status(400).json({ success: false, message: 'nu_telefone_completo é obrigatório' });
    }

    const cobranca = await WebCobrancas.findByPk(req.params.id, {
      include: [{ model: WebCobrancaItens, as: 'itens' }]
    });
    if (!cobranca) return res.status(404).json({ success: false, message: 'Cobrança não encontrada' });
    if (Number(cobranca.web_veterinarios_id) !== req.vetId) {
      return res.status(403).json({ success: false, message: 'Cobrança não pertence a este veterinário' });
    }

    const vet = await WebVeterinarios.findByPk(cobranca.web_veterinarios_id);
    if (!vet) return res.status(404).json({ success: false, message: 'Veterinário não encontrado' });

    const linkResultado = await criarLinkCheckout(cobranca, vet);
    if (!linkResultado.success) return res.status(400).json(linkResultado);

    const resultadoEnvio = await enviarWhatsAppCobranca({
      telefone: nu_telefone_completo,
      clienteNome: cobranca.cliente_nome,
      descricao: cobranca.descricao,
      valorFormatado: formatarBRL(cobranca.total_cents),
      link: linkResultado.url,
      nomeVet: vet.no_completo || 'Veterinário'
    });

    if (!resultadoEnvio.ok) {
      return res.status(500).json({
        success: false,
        message: `Falha ao enviar WhatsApp: ${resultadoEnvio.error || 'motivo desconhecido'}`
      });
    }
    return res.json({ success: true, message: 'WhatsApp enviado com sucesso', url: linkResultado.url });
  } catch (err) {
    console.error('POST /cobrancas/:id/whatsapp', err);
    return res.status(500).json({ success: false, message: `Erro ao enviar WhatsApp: ${err.message}` });
  }
});

// Garante que a cobrança existe e (se vetId informado) pertence ao veterinário.
async function carregarCobrancaDoVet(cobrancaId, vetId, res) {
  const cobranca = await WebCobrancas.findByPk(cobrancaId);
  if (!cobranca) {
    res.status(404).json({ success: false, message: 'Cobrança não encontrada' });
    return null;
  }
  if (vetId && Number(cobranca.web_veterinarios_id) !== Number(vetId)) {
    res.status(403).json({ success: false, message: 'Cobrança não pertence a este veterinário' });
    return null;
  }
  return cobranca;
}

// POST /cobrancas/:id/anexos  (multipart: arquivo) body: { vetId }
route.post('/cobrancas/:id/anexos', uploadAnexo.single('arquivo'), async (req, res) => {
  try {
    const cobranca = await carregarCobrancaDoVet(req.params.id, req.vetId, res);
    if (!cobranca) return;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Envie um arquivo PDF ou imagem (até 10 MB)' });
    }

    const s3Key = nomeAnexoUnico(req.file.originalname);
    await uploadToS3(req.file.buffer, s3Key, req.file.mimetype);

    const anexo = await WebCobrancaAnexos.create({
      web_cobrancas_id: cobranca.id,
      nome_original: (req.file.originalname || 'arquivo').slice(0, 255),
      s3_key: s3Key,
      content_type: req.file.mimetype,
      tamanho_bytes: req.file.size
    });

    return res.json({ success: true, anexo });
  } catch (err) {
    console.error('POST /cobrancas/:id/anexos', err);
    return res.status(500).json({ success: false, message: 'Erro ao anexar arquivo' });
  }
});

// GET /cobrancas/:id/anexos/:anexoId/url  → URL assinada temporária para abrir/baixar
route.get('/cobrancas/:id/anexos/:anexoId/url', async (req, res) => {
  try {
    const cobranca = await carregarCobrancaDoVet(req.params.id, req.vetId, res);
    if (!cobranca) return;
    const anexo = await WebCobrancaAnexos.findByPk(req.params.anexoId);
    if (!anexo || Number(anexo.web_cobrancas_id) !== Number(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Anexo não encontrado' });
    }
    const { url } = await getSignedUrlForDownload(anexo.s3_key, 300);
    return res.json({ success: true, url });
  } catch (err) {
    console.error('GET /cobrancas/:id/anexos/:anexoId/url', err);
    return res.status(500).json({ success: false, message: 'Erro ao gerar link do anexo' });
  }
});

// DELETE /cobrancas/:id/anexos/:anexoId  body: { vetId }
route.delete('/cobrancas/:id/anexos/:anexoId', async (req, res) => {
  try {
    const cobranca = await carregarCobrancaDoVet(req.params.id, req.vetId, res);
    if (!cobranca) return;

    const anexo = await WebCobrancaAnexos.findByPk(req.params.anexoId);
    if (!anexo || Number(anexo.web_cobrancas_id) !== Number(cobranca.id)) {
      return res.status(404).json({ success: false, message: 'Anexo não encontrado' });
    }

    await deleteFile(anexo.s3_key);
    await anexo.destroy();

    return res.json({ success: true });
  } catch (err) {
    console.error('DELETE /cobrancas/:id/anexos/:anexoId', err);
    return res.status(500).json({ success: false, message: 'Erro ao excluir anexo' });
  }
});

module.exports = route;
// Reutilizado pelo Portal do Responsável (gerar link de pagamento da cobrança).
module.exports.criarLinkCheckout = criarLinkCheckout;
