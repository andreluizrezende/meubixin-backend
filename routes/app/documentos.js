'use strict';
/*
 * DOCUMENTOS DO PET no app do responsável.
 *
 * Junta num só lugar tudo que o veterinário deixou disponível para aquele
 * animal, separado por tipo: ATESTADO, PRESCRIÇÃO e TERMO.
 *
 *   GET /app/documentos/animal/:animalId?cpf=
 *   GET /app/documentos/termo/:id/pdf?cpf=
 *
 * Os PDFs de atestado e prescrição já têm rota própria — `/app/atestados/:id/pdf`
 * e `/app/prescricoes/:anamneseId/pdf` — e são reusados. Só o termo não tinha.
 *
 * O QUE OS TRÊS TÊM EM COMUM: a disponibilidade sai de `web_registros_prescricoes`,
 * que é polimórfica (`tp_origem` ∈ prescricao | atestado | termo) e guarda o
 * `arquivo_s3_path` do PDF. Só entra o que está `status='assinada'`.
 *
 * ⚠️ "Assinada" NÃO quer dizer a mesma coisa nos três:
 * - prescrição e atestado são assinados DIGITALMENTE pelo veterinário;
 * - o TERMO é assinado em PAPEL pelo responsável e depois digitalizado pelo vet
 *   (ver `routes/termos/termos.js`, que não barra PDF sem assinatura digital).
 * Por isso o termo vai marcado com `assinatura: 'papel'` — a tela não deve
 * apresentá-lo como documento com assinatura digital, que ele não tem.
 */
const express = require('express');
const route = express.Router();
const { QueryTypes } = require('sequelize');
const models = require('../../models');
const { sequelize } = models;
const { getSignedUrlForDownload } = require('../../utils/s3_teste');

const soDigitos = (v) => String(v || '').replace(/\D/g, '');
const CPF_SQL = `REPLACE(REPLACE(REPLACE(t.nu_cpf, '.', ''), '-', ''), ' ', '')`;

const ROTULO_ATESTADO = {
  saude: 'Atestado de Saúde Animal',
  vacinacao: 'Atestado de Vacinação',
  carteira_vacinacao: 'Carteira de Vacinação',
  obito: 'Atestado de Óbito',
};

const ROTULO_TERMO = {
  retirada_sem_alta: 'Termo de Retirada sem Alta',
  cirurgico: 'Termo de Consentimento Cirúrgico',
  anestesico: 'Termo de Consentimento Anestésico',
  ciencia_risco: 'Termo de Ciência de Risco',
};

function exigirCpf(valor, res) {
  const cpf = soDigitos(valor);
  if (!cpf) {
    res.status(400).json({ success: false, message: 'Informe o CPF do responsável.' });
    return null;
  }
  return cpf;
}

async function animalDoTutor(animalId, cpf) {
  const [linha] = await sequelize.query(
    `SELECT an.id, an.no_nome
       FROM mob_animais an
       JOIN mob_tutores t ON t.id = an.mob_tutores_id
      WHERE an.id = :animalId AND ${CPF_SQL} = :cpf
      LIMIT 1`,
    { replacements: { animalId, cpf }, type: QueryTypes.SELECT }
  );
  return linha || null;
}

// GET /app/documentos/animal/:animalId?cpf=
route.get('/app/documentos/animal/:animalId', async (req, res) => {
  try {
    const cpf = exigirCpf(req.query.cpf, res);
    if (!cpf) return;

    const { animalId } = req.params;
    const animal = await animalDoTutor(animalId, cpf);
    if (!animal) {
      // 404 e não 403: não confirma a existência do pet para quem não é o tutor.
      return res.status(404).json({ success: false, message: 'Paciente não encontrado.' });
    }

    const vet = `v.no_completo AS vet_nome, v.nu_crmv, v.ds_estado_crmv`;

    const atestados = await sequelize.query(
      `SELECT at.id, at.tp_atestado, at.ds_finalidade, at.dt_emissao, at.dt_validade,
              r.codigo_verificacao, r.dt_assinatura, ${vet}
         FROM web_atestados at
         JOIN web_registros_prescricoes r
              ON r.web_atestados_id = at.id AND r.tp_origem = 'atestado' AND r.status = 'assinada'
         LEFT JOIN web_veterinarios v ON v.id = at.web_veterinarios_id
        WHERE at.mob_animais_id = :animalId AND at.ds_status = 'ativo'
        ORDER BY at.dt_emissao DESC`,
      { replacements: { animalId }, type: QueryTypes.SELECT }
    );

    const prescricoes = await sequelize.query(
      `SELECT a.id AS anamnese_id, a.dt_data_anamnese, a.ds_orientacoes,
              r.codigo_verificacao, r.dt_assinatura, ${vet},
              (SELECT COUNT(*) FROM web_protocolos p WHERE p.web_anamneses_id = a.id) AS qt_protocolos
         FROM web_anamneses a
         JOIN web_registros_prescricoes r
              ON r.web_anamneses_id = a.id AND r.tp_origem = 'prescricao' AND r.status = 'assinada'
         LEFT JOIN web_veterinarios v ON v.id = a.web_veterinarios_id
        WHERE a.mob_animais_id = :animalId
        ORDER BY r.dt_assinatura DESC`,
      { replacements: { animalId }, type: QueryTypes.SELECT }
    );

    const termos = await sequelize.query(
      `SELECT te.id, te.tp_termo, te.ds_procedimento, te.dt_emissao,
              r.codigo_verificacao, r.dt_assinatura, ${vet}
         FROM web_termos te
         JOIN web_registros_prescricoes r
              ON r.web_termos_id = te.id AND r.tp_origem = 'termo' AND r.status = 'assinada'
         LEFT JOIN web_veterinarios v ON v.id = te.web_veterinarios_id
        WHERE te.mob_animais_id = :animalId AND te.ds_status = 'ativo'
        ORDER BY te.dt_emissao DESC`,
      { replacements: { animalId }, type: QueryTypes.SELECT }
    );

    const prof = (d) => ({
      nome: d.vet_nome || null,
      crmv: d.nu_crmv ? `${d.nu_crmv}${d.ds_estado_crmv ? '/' + d.ds_estado_crmv : ''}` : null,
    });

    return res.json({
      success: true,
      animal: { id: animal.id, nome: animal.no_nome },
      atestados: atestados.map((d) => ({
        id: d.id,
        tipo: d.tp_atestado,
        titulo: ROTULO_ATESTADO[d.tp_atestado] || 'Atestado',
        finalidade: d.ds_finalidade,
        dt_emissao: d.dt_emissao,
        dt_validade: d.dt_validade,
        // Vencido é derivado, não guardado: a validade é uma data e "hoje" muda.
        vencido: d.dt_validade ? new Date(d.dt_validade).getTime() < Date.now() : false,
        codigo_verificacao: d.codigo_verificacao,
        assinatura: 'digital',
        veterinario: prof(d),
      })),
      prescricoes: prescricoes.map((d) => ({
        id: d.anamnese_id,
        titulo: 'Receita',
        dt_emissao: d.dt_data_anamnese,
        dt_assinatura: d.dt_assinatura,
        qt_protocolos: Number(d.qt_protocolos) || 0,
        observacoes: d.ds_orientacoes || null,
        codigo_verificacao: d.codigo_verificacao,
        assinatura: 'digital',
        veterinario: prof(d),
      })),
      termos: termos.map((d) => ({
        id: d.id,
        tipo: d.tp_termo,
        titulo: ROTULO_TERMO[d.tp_termo] || 'Termo',
        procedimento: d.ds_procedimento,
        dt_emissao: d.dt_emissao,
        codigo_verificacao: d.codigo_verificacao,
        // ⚠️ papel, não digital — ver o aviso no topo do arquivo
        assinatura: 'papel',
        veterinario: prof(d),
      })),
    });
  } catch (err) {
    console.error('GET /app/documentos/animal/:animalId', err);
    return res.status(500).json({ success: false, message: 'Erro ao listar os documentos: ' + err.message });
  }
});

// GET /app/documentos/termo/:id/pdf?cpf=
// Atestado e prescrição já têm rota de PDF; só o termo faltava.
route.get('/app/documentos/termo/:id/pdf', async (req, res) => {
  try {
    const cpf = exigirCpf(req.query.cpf, res);
    if (!cpf) return;

    const [registro] = await sequelize.query(
      `SELECT r.arquivo_s3_path, r.codigo_verificacao
         FROM web_termos te
         JOIN mob_animais an ON an.id = te.mob_animais_id
         JOIN mob_tutores t ON t.id = an.mob_tutores_id
         JOIN web_registros_prescricoes r
              ON r.web_termos_id = te.id AND r.tp_origem = 'termo' AND r.status = 'assinada'
        WHERE te.id = :id
          AND te.ds_status = 'ativo'
          AND ${CPF_SQL} = :cpf
          AND r.arquivo_s3_path IS NOT NULL
        ORDER BY r.id DESC
        LIMIT 1`,
      { replacements: { id: req.params.id, cpf }, type: QueryTypes.SELECT }
    );

    if (!registro) {
      return res.status(404).json({ success: false, message: 'Termo não encontrado.' });
    }

    const urlData = await getSignedUrlForDownload(registro.arquivo_s3_path, 3600);
    return res.json({
      success: true,
      url: urlData.url,
      expiresIn: urlData.expiresIn,
      fileName: `termo-${registro.codigo_verificacao}.pdf`,
    });
  } catch (err) {
    console.error('GET /app/documentos/termo/:id/pdf', err);
    return res.status(500).json({ success: false, message: 'Erro ao gerar o link do PDF: ' + err.message });
  }
});

module.exports = route;
