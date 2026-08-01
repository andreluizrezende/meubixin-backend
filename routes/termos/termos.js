// Termos de consentimento / ciência — Res. CFMV 1.321/2020, alterada pela
// 1.653/2025.
//
// Espelha routes/atestados/atestados.js: mesmo motor de assinatura (registro
// polimórfico em web_registros_prescricoes), mesmo código de verificação, mesmo
// upload para o S3. A diferença de FUNDO é quem assina: no atestado é o
// veterinário; aqui é o RESPONSÁVEL, em papel, e o vet sobe o digitalizado. Do
// ponto de vista do backend o fluxo é idêntico — o que muda é o documento.
//
// ⚠️ Este router faz `route.use(requireAuth)` sem path → precisa ser montado por
// ÚLTIMO no index.js, junto de rotaAtestados. Ver o footgun documentado no
// CLAUDE.md.
const express = require('express');
const route = express.Router();
const crypto = require('crypto');
const multer = require('multer');
const { QueryTypes } = require('sequelize');
const models = require('../../models');
const { WebTermos, web_registros_prescricoes, sequelize } = models;
const requireAuth = require('../../middleware/requireAuth');
const { uploadToS3, getSignedUrlForDownload } = require('../../utils/s3_teste');
const { verifyPDF } = require('../../utils/pdfVerification');

route.use(requireAuth);

const TIPOS_VALIDOS = ['retirada_sem_alta', 'cirurgico', 'anestesico', 'ciencia_risco'];
const TIPO_LABEL = {
  retirada_sem_alta: 'Termo de Retirada sem Alta Médica',
  cirurgico: 'Termo de Consentimento para Procedimento Cirúrgico',
  anestesico: 'Termo de Consentimento para Procedimento Anestésico',
  ciencia_risco: 'Termo de Ciência de Risco e Prognóstico',
};
// Janela para assinar e subir o PDF — a mesma da prescrição e do atestado.
const MINUTOS_EXPIRACAO = 30;

// Prefixo TC- (receita usa RX-, atestado usa AT-), para o código dizer o que é.
const gerarCodigoVerificacao = () => {
  const ano = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `TC-${ano}-${timestamp}${random}`;
};

const gerarHashDados = (dados) =>
  crypto.createHash('sha256').update(JSON.stringify(dados, Object.keys(dados).sort())).digest('hex');

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Apenas arquivos PDF são permitidos'), false);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Carrega o termo garantindo que é do vet logado (o id vem do cliente).
async function acharDoVet(id, vetId) {
  return WebTermos.findOne({ where: { id, web_veterinarios_id: vetId } });
}

// ---------------------------------------------------------------- CRUD

// POST /termos
route.post('/termos', async (req, res) => {
  try {
    const { mob_animais_id, tp_termo } = req.body;
    if (!mob_animais_id) {
      return res.status(400).json({ success: false, message: 'Informe o paciente (mob_animais_id).' });
    }
    if (!TIPOS_VALIDOS.includes(tp_termo)) {
      return res.status(400).json({ success: false, message: `Tipo inválido. Use: ${TIPOS_VALIDOS.join(', ')}.` });
    }
    const b = req.body;
    const termo = await WebTermos.create({
      web_veterinarios_id: req.vetId, // identidade SEMPRE da sessão, nunca do corpo
      mob_animais_id,
      web_anamneses_id: b.web_anamneses_id || null,
      tp_termo,
      ds_procedimento: b.ds_procedimento || null,
      ds_riscos: b.ds_riscos || null,
      ds_texto: b.ds_texto || null,
      ds_observacoes: b.ds_observacoes || null,
      dt_retirada: b.dt_retirada ? new Date(b.dt_retirada) : null,
      ds_estado_clinico: b.ds_estado_clinico || null,
      dt_emissao: b.dt_emissao ? new Date(b.dt_emissao) : new Date(),
      ds_status: 'ativo',
    });
    return res.status(201).json({ success: true, termo });
  } catch (err) {
    console.error('POST /termos', err);
    return res.status(500).json({ success: false, message: 'Erro ao criar termo: ' + err.message });
  }
});

// GET /termos?animalId=&tipo=
route.get('/termos', async (req, res) => {
  try {
    const where = { web_veterinarios_id: req.vetId };
    if (req.query.animalId) where.mob_animais_id = parseInt(req.query.animalId, 10);
    if (req.query.tipo) where.tp_termo = req.query.tipo;

    const termos = await WebTermos.findAll({
      where,
      order: [['dt_emissao', 'DESC']],
      include: [{
        model: web_registros_prescricoes,
        as: 'registros',
        attributes: ['codigo_verificacao', 'status', 'dt_assinatura'],
        required: false,
      }],
    });
    return res.json({ success: true, termos });
  } catch (err) {
    console.error('GET /termos', err);
    return res.status(500).json({ success: false, message: 'Erro ao listar termos: ' + err.message });
  }
});

// GET /termos/:id
route.get('/termos/:id', async (req, res) => {
  try {
    const termo = await WebTermos.findOne({
      where: { id: req.params.id, web_veterinarios_id: req.vetId },
      include: [{ model: web_registros_prescricoes, as: 'registros', required: false }],
    });
    if (!termo) return res.status(404).json({ success: false, message: 'Termo não encontrado.' });
    return res.json({ success: true, termo });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao buscar termo: ' + err.message });
  }
});

// PUT /termos/:id — bloqueia depois de assinado: o PDF no S3 e o hash já não
// corresponderiam ao conteúdo (mesma regra do atestado).
route.put('/termos/:id', async (req, res) => {
  try {
    const termo = await acharDoVet(req.params.id, req.vetId);
    if (!termo) return res.status(404).json({ success: false, message: 'Termo não encontrado.' });

    const assinado = await web_registros_prescricoes.findOne({
      where: { tp_origem: 'termo', web_termos_id: termo.id, status: 'assinada' },
    });
    if (assinado) {
      return res.status(409).json({
        success: false,
        message: 'Termo já assinado não pode ser editado. Cancele e emita um novo.',
      });
    }

    const b = req.body;
    const campos = ['ds_procedimento', 'ds_riscos', 'ds_texto', 'ds_observacoes', 'ds_estado_clinico'];
    const dados = {};
    campos.forEach((c) => { if (c in b) dados[c] = b[c] || null; });
    ['dt_retirada', 'dt_emissao'].forEach((c) => {
      if (c in b) dados[c] = b[c] ? new Date(b[c]) : null;
    });
    if (b.web_anamneses_id !== undefined) dados.web_anamneses_id = b.web_anamneses_id || null;

    await termo.update(dados);
    return res.json({ success: true, termo });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao editar termo: ' + err.message });
  }
});

// POST /termos/:id/cancelar
route.post('/termos/:id/cancelar', async (req, res) => {
  try {
    const termo = await acharDoVet(req.params.id, req.vetId);
    if (!termo) return res.status(404).json({ success: false, message: 'Termo não encontrado.' });
    await termo.update({ ds_status: 'cancelado' });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao cancelar termo: ' + err.message });
  }
});

// ------------------------------------------------- assinatura (espelha o atestado)

// GET /termos/:id/dados-pdf
route.get('/termos/:id/dados-pdf', async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const termo = await WebTermos.findOne({
      where: { id: req.params.id, web_veterinarios_id: req.vetId },
      transaction,
    });
    if (!termo) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Termo não encontrado.' });
    }

    // Dados do documento em UMA consulta: vet (+ endereço/estabelecimento),
    // animal (+ perfil e identificação oficial) e responsável (+ endereço).
    // LEFT JOIN em web_tutor_perfil de propósito: o satélite quase sempre não
    // tem linha, e um INNER faria o termo inteiro sumir.
    const [dados] = await sequelize.query(
      `SELECT
         v.no_completo AS vet_nome, v.nu_crmv, v.ds_estado_crmv,
         v.ds_email AS vet_email, v.nu_telefone_completo AS vet_telefone,
         v.ds_logradouro AS vet_logradouro, v.nu_numero AS vet_numero,
         v.ds_complemento AS vet_complemento, v.ds_bairro AS vet_bairro,
         v.ds_cidade AS vet_cidade, v.ds_uf AS vet_uf, v.nu_cep AS vet_cep,
         v.ds_clinica_nome, v.nu_clinica_cnpj, v.nu_clinica_crmv_pj,
         a.no_nome AS animal_nome, a.ds_especie, a.ds_sexo, a.ds_pelagem,
         a.vl_idade, a.vl_peso,
         pp.ds_raca, pp.dt_nascimento, pp.ds_porte, pp.st_castrado,
         pp.ds_sinais_particulares, pp.ds_tatuagem, pp.ds_brinco,
         pp.nu_microchip, pp.ds_registro_genealogico, pp.ds_resenha,
         t.id AS tutor_id, t.no_completo AS tutor_nome, t.nu_cpf AS tutor_cpf,
         t.ds_email AS tutor_email, t.nu_telefone_completo AS tutor_telefone,
         tp.ds_logradouro AS tutor_logradouro, tp.nu_numero AS tutor_numero,
         tp.ds_complemento AS tutor_complemento, tp.ds_bairro AS tutor_bairro,
         tp.ds_cidade AS tutor_cidade, tp.ds_uf AS tutor_uf, tp.nu_cep AS tutor_cep
       FROM web_termos te
       JOIN web_veterinarios v ON v.id = te.web_veterinarios_id
       JOIN mob_animais a ON a.id = te.mob_animais_id
       LEFT JOIN web_pet_perfil pp ON pp.mob_animais_id = a.id
       LEFT JOIN mob_tutores t ON t.id = a.mob_tutores_id
       LEFT JOIN web_tutor_perfil tp ON tp.mob_tutores_id = t.id
      WHERE te.id = :id`,
      { replacements: { id: termo.id }, type: QueryTypes.SELECT, transaction }
    );

    const payload = {
      termo: termo.toJSON(),
      titulo: TIPO_LABEL[termo.tp_termo] || 'Termo',
      ...dados,
    };
    const hashDados = gerarHashDados(payload);

    // Reaproveita o código quando nada mudou e ainda está no prazo.
    const agora = new Date();
    const existente = await web_registros_prescricoes.findOne({
      where: { tp_origem: 'termo', web_termos_id: termo.id, status: 'pendente' },
      order: [['id', 'DESC']],
      transaction,
    });

    let codigoVerificacao;
    if (existente && agora < existente.dt_expiracao && existente.hash_original === hashDados) {
      codigoVerificacao = existente.codigo_verificacao;
    } else {
      if (existente) await existente.update({ status: 'expirada' }, { transaction });
      codigoVerificacao = gerarCodigoVerificacao();
      await web_registros_prescricoes.create({
        tp_origem: 'termo',
        web_termos_id: termo.id,
        web_atestados_id: null,
        web_anamneses_id: null,
        codigo_verificacao: codigoVerificacao,
        status: 'pendente',
        hash_original: hashDados,
        dt_criacao: agora,
        dt_expiracao: new Date(agora.getTime() + MINUTOS_EXPIRACAO * 60 * 1000),
      }, { transaction });
    }

    await transaction.commit();
    return res.json({ success: true, codigoVerificacao, hashDados, dados: payload });
  } catch (err) {
    if (!transaction.finished) await transaction.rollback();
    console.error('GET /termos/:id/dados-pdf', err);
    return res.status(500).json({ success: false, message: 'Erro ao montar o termo: ' + err.message });
  }
});

// POST /termos/:id/upload-assinado
route.post('/termos/:id/upload-assinado', upload.single('pdfAssinado'), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const arquivo = req.file;
    if (!arquivo) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Arquivo PDF é obrigatório' });
    }

    const termo = await WebTermos.findOne({
      where: { id: req.params.id, web_veterinarios_id: req.vetId },
      transaction,
    });
    if (!termo) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Termo não encontrado.' });
    }

    // ⚠️ Diferente do atestado, aqui NÃO se exige assinatura digital no PDF: quem
    // assina é o responsável, à mão, e o vet sobe o documento digitalizado. Exigir
    // `verifyPDF` inviabilizaria o fluxo escolhido. A validade do documento vem da
    // assinatura manuscrita no papel; o sistema garante rastreabilidade (código de
    // verificação + hash do conteúdo gerado + arquivo no S3).
    const verificacao = verifyPDF(arquivo.buffer);

    const registro = await web_registros_prescricoes.findOne({
      where: { tp_origem: 'termo', web_termos_id: termo.id, status: 'pendente' },
      order: [['id', 'DESC']],
      transaction,
    });
    if (!registro) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Registro não encontrado ou já processado.' });
    }

    const agora = new Date();
    if (agora > registro.dt_expiracao) {
      await registro.update({ status: 'expirada' }, { transaction });
      await transaction.commit();
      return res.status(400).json({ success: false, message: 'Tempo para upload expirado. Gere o PDF novamente.' });
    }

    const nomeArquivo = `termos/${termo.id}/${registro.codigo_verificacao}-assinado.pdf`;
    await uploadToS3(arquivo.buffer, nomeArquivo);
    await registro.update({
      status: 'assinada',
      arquivo_s3_path: nomeArquivo,
      dt_assinatura: agora,
      dt_upload: agora,
    }, { transaction });

    await transaction.commit();
    return res.json({
      success: true,
      message: 'Termo assinado enviado com sucesso!',
      assinaturaDigital: !!verificacao.verified, // informativo: papel digitalizado normalmente é false
      codigoVerificacao: registro.codigo_verificacao,
      urlVerificacao: `${process.env.FRONTEND_URL || ''}/verificar/${registro.codigo_verificacao}`,
    });
  } catch (err) {
    if (!transaction.finished) await transaction.rollback();
    console.error('POST /termos/:id/upload-assinado', err);
    return res.status(500).json({ success: false, message: 'Erro no upload: ' + err.message });
  }
});

// GET /termos/:id/url-pdf
route.get('/termos/:id/url-pdf', async (req, res) => {
  try {
    const termo = await acharDoVet(req.params.id, req.vetId);
    if (!termo) return res.status(404).json({ success: false, message: 'Termo não encontrado.' });

    const registro = await web_registros_prescricoes.findOne({
      where: { tp_origem: 'termo', web_termos_id: termo.id, status: 'assinada' },
      order: [['id', 'DESC']],
    });
    if (!registro || !registro.arquivo_s3_path) {
      return res.status(404).json({ success: false, message: 'Termo assinado não encontrado.' });
    }

    const expiresIn = parseInt(req.query.expiresIn, 10) || 3600;
    const urlData = await getSignedUrlForDownload(registro.arquivo_s3_path, expiresIn);
    return res.json({
      success: true,
      url: urlData.url,
      expiresIn: urlData.expiresIn,
      fileName: `termo-${registro.codigo_verificacao}.pdf`,
      codigoVerificacao: registro.codigo_verificacao,
    });
  } catch (err) {
    console.error('GET /termos/:id/url-pdf', err);
    return res.status(500).json({ success: false, message: 'Erro ao gerar URL: ' + err.message });
  }
});

module.exports = route;
