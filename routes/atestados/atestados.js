'use strict';
/*
 * ATESTADOS médico-veterinários (Resolução CFMV 1.321/2020).
 *
 * As rotas de assinatura espelham as da prescrição e REUSAM o mesmo motor:
 * web_registros_prescricoes (polimórfica, tp_origem='atestado'), o mesmo
 * gerador de código, o mesmo verifyPDF, o mesmo S3 e a MESMA tela pública de
 * conferência (/verificar/:codigo). Nada disso foi duplicado.
 *
 *   POST /atestados                      criar
 *   GET  /atestados?animalId=            listar (do vet logado)
 *   GET  /atestados/:id                  detalhe
 *   PUT  /atestados/:id                  editar (enquanto não assinado)
 *   POST /atestados/:id/cancelar         cancelar
 *   GET  /atestados/:id/dados-pdf        dados + código de verificação (cria o registro pendente)
 *   POST /atestados/:id/upload-assinado  sobe o PDF assinado para o S3
 *   GET  /atestados/:id/url-pdf          URL assinada de download
 *
 * requireAuth é aplicado no router inteiro → montar POR ÚLTIMO no index.js
 * (mesmo footgun de connect/cobrancas/assinatura/agenda).
 */
const express = require('express');
const route = express.Router();
const crypto = require('crypto');
const multer = require('multer');
const { QueryTypes } = require('sequelize');
const models = require('../../models');
const { WebAtestados, web_registros_prescricoes, sequelize } = models;
const requireAuth = require('../../middleware/requireAuth');
const { uploadToS3, getSignedUrlForDownload } = require('../../utils/s3_teste');
const { verifyPDF } = require('../../utils/pdfVerification');

route.use(requireAuth);

const TIPOS_VALIDOS = ['saude', 'vacinacao', 'carteira_vacinacao', 'obito'];
const TIPO_LABEL = {
  saude: 'Atestado de Saúde Animal',
  vacinacao: 'Atestado de Vacinação',
  carteira_vacinacao: 'Carteira de Vacinação',
  obito: 'Atestado de Óbito',
};
// Janela para assinar e subir o PDF — a mesma da prescrição.
const MINUTOS_EXPIRACAO = 30;

// Prefixo AT- (a prescrição usa RX-), para o código dizer o que é só de olhar.
const gerarCodigoVerificacao = () => {
  const ano = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `AT-${ano}-${timestamp}${random}`;
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

// Carrega o atestado garantindo que é do vet logado (o id vem do cliente).
async function acharDoVet(id, vetId) {
  return WebAtestados.findOne({ where: { id, web_veterinarios_id: vetId } });
}

// ---------------------------------------------------------------- CRUD

// POST /atestados
route.post('/atestados', async (req, res) => {
  try {
    const { mob_animais_id, tp_atestado } = req.body;
    if (!mob_animais_id) {
      return res.status(400).json({ success: false, message: 'Informe o paciente (mob_animais_id).' });
    }
    if (!TIPOS_VALIDOS.includes(tp_atestado)) {
      return res.status(400).json({ success: false, message: `Tipo inválido. Use: ${TIPOS_VALIDOS.join(', ')}.` });
    }
    const b = req.body;
    const atestado = await WebAtestados.create({
      web_veterinarios_id: req.vetId, // identidade SEMPRE da sessão, nunca do corpo
      mob_animais_id,
      web_anamneses_id: b.web_anamneses_id || null,
      tp_atestado,
      ds_finalidade: b.ds_finalidade || null,
      ds_texto: b.ds_texto || null,
      ds_observacoes: b.ds_observacoes || null,
      dt_emissao: b.dt_emissao ? new Date(b.dt_emissao) : new Date(),
      dt_validade: b.dt_validade ? new Date(b.dt_validade) : null,
      dt_obito: b.dt_obito ? new Date(b.dt_obito) : null,
      ds_causa_mortis: b.ds_causa_mortis || null,
      ds_local_obito: b.ds_local_obito || null,
      ds_destino_corpo: b.ds_destino_corpo || null,
      ds_status: 'ativo',
    });
    return res.status(201).json({ success: true, atestado });
  } catch (err) {
    console.error('POST /atestados', err);
    return res.status(500).json({ success: false, message: 'Erro ao criar atestado: ' + err.message });
  }
});

// GET /atestados?animalId=&tipo=
route.get('/atestados', async (req, res) => {
  try {
    const where = { web_veterinarios_id: req.vetId };
    if (req.query.animalId) where.mob_animais_id = parseInt(req.query.animalId, 10);
    if (req.query.tipo) where.tp_atestado = req.query.tipo;

    const atestados = await WebAtestados.findAll({
      where,
      order: [['dt_emissao', 'DESC']],
      include: [{
        model: web_registros_prescricoes,
        as: 'registros',
        attributes: ['codigo_verificacao', 'status', 'dt_assinatura'],
        required: false,
      }],
    });
    return res.json({ success: true, atestados });
  } catch (err) {
    console.error('GET /atestados', err);
    return res.status(500).json({ success: false, message: 'Erro ao listar atestados: ' + err.message });
  }
});

// GET /atestados/:id — antes das rotas com sufixo? Não: Express casa por ordem e
// os sufixos abaixo são mais específicos, mas '/atestados/:id' casaria com
// '/atestados/5/url-pdf'? Não — o path tem segmentos a mais. Ordem é segura.
route.get('/atestados/:id', async (req, res) => {
  try {
    const atestado = await WebAtestados.findOne({
      where: { id: req.params.id, web_veterinarios_id: req.vetId },
      include: [{ model: web_registros_prescricoes, as: 'registros', required: false }],
    });
    if (!atestado) return res.status(404).json({ success: false, message: 'Atestado não encontrado.' });
    return res.json({ success: true, atestado });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao buscar atestado: ' + err.message });
  }
});

// PUT /atestados/:id — editar. Bloqueia depois de assinado: o PDF no S3 e o hash
// já não corresponderiam ao conteúdo.
route.put('/atestados/:id', async (req, res) => {
  try {
    const atestado = await acharDoVet(req.params.id, req.vetId);
    if (!atestado) return res.status(404).json({ success: false, message: 'Atestado não encontrado.' });

    const assinado = await web_registros_prescricoes.findOne({
      where: { tp_origem: 'atestado', web_atestados_id: atestado.id, status: 'assinada' },
    });
    if (assinado) {
      return res.status(409).json({
        success: false,
        message: 'Atestado já assinado não pode ser editado. Cancele e emita um novo.',
      });
    }

    const b = req.body;
    const campos = [
      'ds_finalidade', 'ds_texto', 'ds_observacoes',
      'ds_causa_mortis', 'ds_local_obito', 'ds_destino_corpo',
    ];
    const dados = {};
    campos.forEach((c) => { if (c in b) dados[c] = b[c] || null; });
    ['dt_validade', 'dt_obito', 'dt_emissao'].forEach((c) => {
      if (c in b) dados[c] = b[c] ? new Date(b[c]) : null;
    });
    if (b.web_anamneses_id !== undefined) dados.web_anamneses_id = b.web_anamneses_id || null;

    await atestado.update(dados);
    return res.json({ success: true, atestado });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao editar atestado: ' + err.message });
  }
});

// POST /atestados/:id/cancelar
route.post('/atestados/:id/cancelar', async (req, res) => {
  try {
    const atestado = await acharDoVet(req.params.id, req.vetId);
    if (!atestado) return res.status(404).json({ success: false, message: 'Atestado não encontrado.' });
    await atestado.update({ ds_status: 'cancelado' });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erro ao cancelar atestado: ' + err.message });
  }
});

// ------------------------------------------------- assinatura (espelha a receita)

// GET /atestados/:id/dados-pdf — monta os dados do documento e garante um registro
// PENDENTE com código de verificação. Reusa o código quando o conteúdo não mudou
// (mesmo hash e dentro do prazo), igual à prescrição.
route.get('/atestados/:id/dados-pdf', async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const atestado = await WebAtestados.findOne({
      where: { id: req.params.id, web_veterinarios_id: req.vetId },
      transaction,
    });
    if (!atestado) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Atestado não encontrado.' });
    }

    // Dados do documento em UMA consulta: vet (+ endereço/estabelecimento),
    // animal (+ perfil) e responsável (+ endereço) — o conteúdo mínimo do CFMV.
    const [dados] = await sequelize.query(
      `SELECT
         v.no_completo AS vet_nome, v.nu_crmv, v.ds_estado_crmv,
         v.ds_email AS vet_email, v.nu_telefone_completo AS vet_telefone,
         v.ds_logradouro AS vet_logradouro, v.nu_numero AS vet_numero,
         v.ds_complemento AS vet_complemento, v.ds_bairro AS vet_bairro,
         v.ds_cidade AS vet_cidade, v.ds_uf AS vet_uf, v.nu_cep AS vet_cep,
         v.ds_clinica_nome, v.nu_clinica_cnpj, v.nu_clinica_crmv_pj, v.ds_logo_s3,
         a.no_nome AS animal_nome, a.ds_especie, a.ds_sexo, a.ds_pelagem,
         a.vl_idade, a.vl_peso,
         pp.ds_raca, pp.dt_nascimento, pp.ds_porte, pp.st_castrado, pp.ds_doencas_cronicas,
         -- Identificação exigida pelos Anexos I/II/XI (Res. CFMV 1.321/2020).
         pp.ds_sinais_particulares, pp.ds_tatuagem, pp.ds_brinco,
         pp.nu_microchip, pp.ds_registro_genealogico, pp.ds_resenha,
         t.id AS tutor_id, t.no_completo AS tutor_nome, t.nu_cpf AS tutor_cpf,
         t.ds_email AS tutor_email, t.nu_telefone_completo AS tutor_telefone,
         tp.ds_logradouro AS tutor_logradouro, tp.nu_numero AS tutor_numero,
         tp.ds_complemento AS tutor_complemento, tp.ds_bairro AS tutor_bairro,
         tp.ds_cidade AS tutor_cidade, tp.ds_uf AS tutor_uf, tp.nu_cep AS tutor_cep
       FROM web_atestados at
       JOIN web_veterinarios v ON v.id = at.web_veterinarios_id
       JOIN mob_animais a ON a.id = at.mob_animais_id
       LEFT JOIN web_pet_perfil pp ON pp.mob_animais_id = a.id
       LEFT JOIN mob_tutores t ON t.id = a.mob_tutores_id
       LEFT JOIN web_tutor_perfil tp ON tp.mob_tutores_id = t.id
      WHERE at.id = :id`,
      { replacements: { id: atestado.id }, type: QueryTypes.SELECT, transaction }
    );

    // Doses aplicadas — só para os documentos de vacinação.
    let vacinas = [];
    if (['vacinacao', 'carteira_vacinacao'].includes(atestado.tp_atestado)) {
      vacinas = await sequelize.query(
        `SELECT ag.id, ag.dt_data_aplicacao, ag.st_concluido,
                ag.ds_lote, ag.ds_fabricante, ag.dt_validade_vacina, ag.ds_via_aplicacao,
                COALESCE(p.nome_protocolo, ps.ds_protocolos_saude) AS nome_protocolo,
                va.no_completo AS aplicador_nome, va.nu_crmv AS aplicador_crmv,
                va.ds_estado_crmv AS aplicador_uf
           FROM web_protocolos_agendas ag
           JOIN web_protocolos p ON p.id = ag.web_protocolos_id
           LEFT JOIN web_protocolos_saude ps ON ps.id = p.web_protocolos_saude_id
           LEFT JOIN web_veterinarios va ON va.id = ag.web_veterinarios_id
           JOIN web_anamneses an ON an.id = p.web_anamneses_id
          WHERE an.mob_animais_id = :animalId AND p.st_tipo_protocolo = 0
          ORDER BY ag.dt_data_aplicacao DESC`,
        { replacements: { animalId: atestado.mob_animais_id }, type: QueryTypes.SELECT, transaction }
      );
    }

    const payload = {
      atestado: atestado.toJSON(),
      titulo: TIPO_LABEL[atestado.tp_atestado] || 'Atestado',
      ...dados,
      vacinas,
    };
    const hashDados = gerarHashDados(payload);

    // Reaproveita o código quando nada mudou e ainda está no prazo.
    const agora = new Date();
    const existente = await web_registros_prescricoes.findOne({
      where: { tp_origem: 'atestado', web_atestados_id: atestado.id, status: 'pendente' },
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
        tp_origem: 'atestado',
        web_atestados_id: atestado.id,
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
    console.error('GET /atestados/:id/dados-pdf', err);
    return res.status(500).json({ success: false, message: 'Erro ao montar o atestado: ' + err.message });
  }
});

// POST /atestados/:id/upload-assinado
route.post('/atestados/:id/upload-assinado', upload.single('pdfAssinado'), async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const arquivo = req.file;
    if (!arquivo) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Arquivo PDF é obrigatório' });
    }

    const atestado = await WebAtestados.findOne({
      where: { id: req.params.id, web_veterinarios_id: req.vetId },
      transaction,
    });
    if (!atestado) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Atestado não encontrado.' });
    }

    const verificacao = verifyPDF(arquivo.buffer);
    if (!verificacao.verified) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'O arquivo PDF não contém uma assinatura digital válida.',
      });
    }

    const registro = await web_registros_prescricoes.findOne({
      where: { tp_origem: 'atestado', web_atestados_id: atestado.id, status: 'pendente' },
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

    const nomeArquivo = `atestados/${atestado.id}/${registro.codigo_verificacao}-assinado.pdf`;
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
      message: 'Atestado assinado enviado com sucesso!',
      codigoVerificacao: registro.codigo_verificacao,
      urlVerificacao: `${process.env.FRONTEND_URL || ''}/verificar/${registro.codigo_verificacao}`,
    });
  } catch (err) {
    if (!transaction.finished) await transaction.rollback();
    console.error('POST /atestados/:id/upload-assinado', err);
    return res.status(500).json({ success: false, message: 'Erro no upload: ' + err.message });
  }
});

// GET /atestados/:id/url-pdf
route.get('/atestados/:id/url-pdf', async (req, res) => {
  try {
    const atestado = await acharDoVet(req.params.id, req.vetId);
    if (!atestado) return res.status(404).json({ success: false, message: 'Atestado não encontrado.' });

    const registro = await web_registros_prescricoes.findOne({
      where: { tp_origem: 'atestado', web_atestados_id: atestado.id, status: 'assinada' },
      order: [['id', 'DESC']],
    });
    if (!registro || !registro.arquivo_s3_path) {
      return res.status(404).json({ success: false, message: 'Atestado assinado não encontrado.' });
    }

    const expiresIn = parseInt(req.query.expiresIn, 10) || 3600;
    const urlData = await getSignedUrlForDownload(registro.arquivo_s3_path, expiresIn);
    return res.json({
      success: true,
      url: urlData.url,
      expiresIn: urlData.expiresIn,
      fileName: `atestado-${registro.codigo_verificacao}.pdf`,
      codigoVerificacao: registro.codigo_verificacao,
    });
  } catch (err) {
    console.error('GET /atestados/:id/url-pdf', err);
    return res.status(500).json({ success: false, message: 'Erro ao gerar URL: ' + err.message });
  }
});

module.exports = route;
