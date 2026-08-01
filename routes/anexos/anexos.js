// Anexos de LAUDO no prontuário — Res. CFMV 1.321/2020, alterada pela 1.653/2025
// ("cópia impressa ou digitalizada de cada laudo de exame laboratorial ou de
// imagem").
//
// Mecânica igual à dos anexos de cobrança (multer em memória → S3 → URL assinada
// na hora de abrir), então nada de novo além do vínculo com a anamnese.
//
// ⚠️ AUTENTICADO, ao contrário do resto das rotas de prescrição/anamnese: isto é
// documento clínico do paciente, não pode ficar aberto. Por usar
// `route.use(requireAuth)` sem path, precisa ser montado por ÚLTIMO no index.js,
// junto de atestados e termos.
//
// ⚠️ Escopo: TODA rota confere que a anamnese é do vet logado antes de qualquer
// coisa — o id vem do cliente. Sem isso, um vet baixaria laudo de paciente alheio
// só trocando o número na URL.
const express = require('express');
const route = express.Router();
const multer = require('multer');
const models = require('../../models');
const { WebAnamneses, WebAnamneseAnexos } = models;
const requireAuth = require('../../middleware/requireAuth');
const { uploadToS3, getSignedUrlForDownload, deleteFile } = require('../../utils/s3_teste');

route.use(requireAuth);

const TIPOS_VALIDOS = ['laboratorial', 'imagem', 'outro'];

// PDF e imagens: é o que sai de laboratório e de aparelho de imagem. 15 MB porque
// laudo de imagem escaneado passa fácil dos 10 MB dos anexos de cobrança.
const MIMES = ['application/pdf', 'image/png', 'image/jpg', 'image/jpeg', 'image/webp'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (MIMES.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Formato não aceito. Envie PDF ou imagem (PNG/JPG/WEBP).'));
  },
});

// O multer sinaliza recusa (tipo errado, tamanho acima do limite) LANÇANDO. Sem
// este wrapper o erro cai no catch genérico da rota e vira 500 — erro de servidor
// para o que é, na verdade, arquivo inválido do usuário. Com ele, o vet vê "Formato
// não aceito" em vez de "erro interno".
const receberArquivo = (req, res, next) => {
  upload.single('arquivo')(req, res, (err) => {
    if (!err) return next();
    const msg = err.code === 'LIMIT_FILE_SIZE'
      ? 'Arquivo acima do limite de 15 MB.'
      : (err.message || 'Arquivo inválido.');
    return res.status(400).json({ success: false, message: msg });
  });
};

const chaveS3 = (anamneseId, originalname) => {
  const ext = String(originalname || '').split('.').pop() || 'bin';
  return `prontuario/${anamneseId}/laudos/${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
};

// Carrega a anamnese garantindo que é do vet logado.
async function anamneseDoVet(anamneseId, vetId) {
  return WebAnamneses.findOne({
    where: { id: anamneseId, web_veterinarios_id: vetId },
    attributes: ['id'],
  });
}

// GET /anamneses/:anamneseId/anexos
route.get('/anamneses/:anamneseId/anexos', async (req, res) => {
  try {
    const anamnese = await anamneseDoVet(req.params.anamneseId, req.vetId);
    if (!anamnese) return res.status(404).json({ success: false, message: 'Consulta não encontrada.' });

    const anexos = await WebAnamneseAnexos.findAll({
      where: { web_anamneses_id: anamnese.id },
      order: [['dt_exame', 'DESC'], ['id', 'DESC']],
    });
    return res.json({ success: true, anexos });
  } catch (err) {
    console.error('GET /anamneses/:id/anexos', err);
    return res.status(500).json({ success: false, message: 'Erro ao listar laudos: ' + err.message });
  }
});

// POST /anamneses/:anamneseId/anexos  (multipart: arquivo)
route.post('/anamneses/:anamneseId/anexos', receberArquivo, async (req, res) => {
  try {
    const anamnese = await anamneseDoVet(req.params.anamneseId, req.vetId);
    if (!anamnese) return res.status(404).json({ success: false, message: 'Consulta não encontrada.' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Envie um arquivo.' });

    const tp = TIPOS_VALIDOS.includes(req.body.tp_anexo) ? req.body.tp_anexo : 'laboratorial';
    const s3Key = chaveS3(anamnese.id, req.file.originalname);
    await uploadToS3(req.file.buffer, s3Key, req.file.mimetype);

    const anexo = await WebAnamneseAnexos.create({
      web_anamneses_id: anamnese.id,
      tp_anexo: tp,
      ds_descricao: req.body.ds_descricao || null,
      dt_exame: req.body.dt_exame || null,
      nome_original: req.file.originalname,
      s3_key: s3Key,
      content_type: req.file.mimetype,
      tamanho_bytes: req.file.size,
    });

    return res.status(201).json({ success: true, anexo });
  } catch (err) {
    console.error('POST /anamneses/:id/anexos', err);
    return res.status(500).json({ success: false, message: 'Erro ao anexar laudo: ' + err.message });
  }
});

// GET /anamneses/:anamneseId/anexos/:anexoId/url → URL assinada temporária
route.get('/anamneses/:anamneseId/anexos/:anexoId/url', async (req, res) => {
  try {
    const anamnese = await anamneseDoVet(req.params.anamneseId, req.vetId);
    if (!anamnese) return res.status(404).json({ success: false, message: 'Consulta não encontrada.' });

    const anexo = await WebAnamneseAnexos.findByPk(req.params.anexoId);
    // Confere o vínculo além do id: sem isto, o anexo de OUTRA consulta do mesmo
    // vet seria acessível informando um anamneseId qualquer que ele possua.
    if (!anexo || Number(anexo.web_anamneses_id) !== Number(anamnese.id)) {
      return res.status(404).json({ success: false, message: 'Laudo não encontrado.' });
    }

    const { url } = await getSignedUrlForDownload(anexo.s3_key, 300);
    return res.json({ success: true, url, fileName: anexo.nome_original });
  } catch (err) {
    console.error('GET /anamneses/:id/anexos/:anexoId/url', err);
    return res.status(500).json({ success: false, message: 'Erro ao gerar link do laudo: ' + err.message });
  }
});

// DELETE /anamneses/:anamneseId/anexos/:anexoId
route.delete('/anamneses/:anamneseId/anexos/:anexoId', async (req, res) => {
  try {
    const anamnese = await anamneseDoVet(req.params.anamneseId, req.vetId);
    if (!anamnese) return res.status(404).json({ success: false, message: 'Consulta não encontrada.' });

    const anexo = await WebAnamneseAnexos.findByPk(req.params.anexoId);
    if (!anexo || Number(anexo.web_anamneses_id) !== Number(anamnese.id)) {
      return res.status(404).json({ success: false, message: 'Laudo não encontrado.' });
    }

    // Apaga a linha primeiro: se o S3 falhar, sobra um objeto órfão no bucket
    // (barato e invisível). Na ordem inversa, uma falha no banco deixaria a
    // listagem apontando para um arquivo que já não existe — erro na cara do vet.
    await anexo.destroy();
    try {
      await deleteFile(anexo.s3_key);
    } catch (e) {
      console.error('Falha ao remover do S3 (registro já removido):', anexo.s3_key, e.message);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('DELETE /anamneses/:id/anexos/:anexoId', err);
    return res.status(500).json({ success: false, message: 'Erro ao remover laudo: ' + err.message });
  }
});

module.exports = route;
