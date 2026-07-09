'use strict';

const express = require('express');
const multer = require('multer');
const route = express.Router();
const models = require('../../models');
const {
  web_veterinarios: WebVeterinarios,
  WebCobrancas,
  WebCobrancaItens,
  WebPagamentos,
  WebCobrancaAnexos
} = models;
const requireAuth = require('../../middleware/requireAuth');
const { getStripe, getWebAppUrl } = require('../../utils/stripeClient');
const { uploadToS3, getSignedUrlForDownload, deleteFile } = require('../../utils/s3_teste');

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
      quantidade: Math.max(1, parseInt(it.quantidade, 10) || 1),
      valor_unitario_cents: Math.max(0, parseInt(it.valor_unitario_cents, 10) || 0),
      ordem: idx
    }))
    .filter((it) => it.descricao && it.valor_unitario_cents > 0);
}

function totalCents(itens) {
  return itens.reduce((acc, it) => acc + it.quantidade * it.valor_unitario_cents, 0);
}

// POST /cobrancas  body: { vetId, cliente_nome, cliente_email?, cliente_documento?, descricao?, itens: [] }
route.post('/cobrancas', async (req, res) => {
  try {
    const { cliente_nome, cliente_email, cliente_documento, descricao, itens, mob_animais_id } = req.body;
    const vet = await WebVeterinarios.findByPk(req.vetId);
    if (!vet) return res.status(404).json({ success: false, message: 'Veterinário não encontrado' });
    if (!cliente_nome || !String(cliente_nome).trim()) {
      return res.status(400).json({ success: false, message: 'Informe o nome do cliente' });
    }

    const itensNorm = normalizarItens(itens);
    if (itensNorm.length === 0) {
      return res.status(400).json({ success: false, message: 'Adicione ao menos um item válido' });
    }

    const cobranca = await WebCobrancas.create({
      web_veterinarios_id: vet.id,
      cliente_nome: String(cliente_nome).trim(),
      cliente_email: cliente_email || null,
      cliente_documento: cliente_documento || null,
      descricao: descricao || null,
      mob_animais_id: mob_animais_id || null,
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
      include: [{ model: WebCobrancaItens, as: 'itens' }],
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
        { model: WebCobrancaAnexos, as: 'anexos' }
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

    // Garante que a cobrança pertence ao veterinário autenticado.
    if (Number(cobranca.web_veterinarios_id) !== req.vetId) {
      return res.status(403).json({ success: false, message: 'Cobrança não pertence a este veterinário' });
    }
    if (cobranca.status === 'paga') {
      return res.status(400).json({ success: false, message: 'Cobrança já foi paga' });
    }

    const vet = await WebVeterinarios.findByPk(cobranca.web_veterinarios_id);
    if (!vet || !vet.stripe_connect_account_id) {
      return res.status(400).json({ success: false, message: 'Conecte sua conta Stripe antes de cobrar' });
    }
    if (!vet.stripe_charges_enabled) {
      return res
        .status(400)
        .json({ success: false, message: 'Conclua o onboarding da Stripe até habilitar recebimentos' });
    }
    if (!cobranca.itens || cobranca.itens.length === 0) {
      return res.status(400).json({ success: false, message: 'Cobrança sem itens' });
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

    return res.json({ success: true, url: session.url });
  } catch (err) {
    console.error('POST /cobrancas/:id/checkout', err);
    return res.status(500).json({ success: false, message: 'Erro ao gerar link de pagamento' });
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
