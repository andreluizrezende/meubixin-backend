'use strict';
/*
 * ATESTADOS no app do RESPONSÁVEL (m-cicatribiovet).
 *
 * O app identifica o responsável pelo CPF — mesmo padrão da rota que ele já usa
 * para listar os pets (`GET /animalCpf/:nu_cpf`). Por isso estas rotas são
 * públicas: seguem o modelo de autenticação do app, que não envia token.
 * ⚠️ Consequência: quem souber um CPF vê os atestados daquele responsável. É o
 * mesmo nível de exposição das demais rotas do app — não introduz um vazamento
 * novo, mas é o ponto a endurecer quando o app ganhar token (o Portal do
 * Responsável já faz isso via JWT de escopo 'portal').
 *
 * Prefixo /app/ para não colidir com o router /atestados, que é autenticado e
 * montado por último (mesmo cuidado tomado em /geo/veterinarios-proximos).
 *
 *   GET /app/atestados/responsavel/:cpf     lista os atestados dos pets do tutor
 *   GET /app/atestados/:id/pdf?cpf=         URL assinada do PDF (S3), escopada
 */
const express = require('express');
const route = express.Router();
const { QueryTypes } = require('sequelize');
const models = require('../../models');
const { sequelize } = models;
const { getSignedUrlForDownload } = require('../../utils/s3_teste');

const TIPO_LABEL = {
  saude: 'Atestado de Saúde Animal',
  vacinacao: 'Atestado de Vacinação',
  carteira_vacinacao: 'Carteira de Vacinação',
  obito: 'Atestado de Óbito',
};

const soDigitos = (v) => String(v || '').replace(/\D/g, '');

// GET /app/atestados/responsavel/:cpf
// Só atestados ATIVOS e ASSINADOS — documento não assinado não tem valor legal
// e não deve chegar ao responsável como se valesse.
route.get('/app/atestados/responsavel/:cpf', async (req, res) => {
  try {
    const cpf = soDigitos(req.params.cpf);
    if (!cpf) return res.status(400).json({ success: false, message: 'CPF inválido.' });

    const linhas = await sequelize.query(
      `SELECT at.id, at.tp_atestado, at.ds_finalidade, at.dt_emissao, at.dt_validade,
              an.id AS animal_id, an.no_nome AS animal_nome, an.ds_especie,
              v.no_completo AS vet_nome, v.nu_crmv, v.ds_estado_crmv,
              r.codigo_verificacao, r.dt_assinatura
         FROM web_atestados at
         JOIN mob_animais an ON an.id = at.mob_animais_id
         JOIN mob_tutores t ON t.id = an.mob_tutores_id
         JOIN web_veterinarios v ON v.id = at.web_veterinarios_id
         JOIN web_registros_prescricoes r
              ON r.web_atestados_id = at.id
             AND r.tp_origem = 'atestado'
             AND r.status = 'assinada'
        WHERE REPLACE(REPLACE(REPLACE(t.nu_cpf, '.', ''), '-', ''), ' ', '') = :cpf
          AND at.ds_status = 'ativo'
        ORDER BY at.dt_emissao DESC`,
      { replacements: { cpf }, type: QueryTypes.SELECT }
    );

    const atestados = linhas.map((a) => ({
      id: a.id,
      tipo: a.tp_atestado,
      titulo: TIPO_LABEL[a.tp_atestado] || 'Atestado',
      finalidade: a.ds_finalidade,
      dt_emissao: a.dt_emissao,
      dt_validade: a.dt_validade,
      // Vencido é derivado, não guardado: a validade é uma data e o "hoje" muda.
      vencido: a.dt_validade ? new Date(a.dt_validade).getTime() < Date.now() : false,
      animal: { id: a.animal_id, nome: a.animal_nome, especie: a.ds_especie },
      veterinario: { nome: a.vet_nome, crmv: `${a.nu_crmv}-${a.ds_estado_crmv}` },
      codigo_verificacao: a.codigo_verificacao,
      dt_assinatura: a.dt_assinatura,
    }));

    return res.json({ success: true, total: atestados.length, atestados });
  } catch (err) {
    console.error('GET /app/atestados/responsavel/:cpf', err);
    return res.status(500).json({ success: false, message: 'Erro ao listar atestados: ' + err.message });
  }
});

// GET /app/atestados/:id/pdf?cpf=
// O CPF volta a ser exigido aqui de propósito: sem ele, um id sequencial daria
// acesso ao PDF de qualquer responsável.
route.get('/app/atestados/:id/pdf', async (req, res) => {
  try {
    const cpf = soDigitos(req.query.cpf);
    if (!cpf) return res.status(400).json({ success: false, message: 'Informe o CPF do responsável.' });

    const [registro] = await sequelize.query(
      `SELECT r.arquivo_s3_path, r.codigo_verificacao
         FROM web_atestados at
         JOIN mob_animais an ON an.id = at.mob_animais_id
         JOIN mob_tutores t ON t.id = an.mob_tutores_id
         JOIN web_registros_prescricoes r
              ON r.web_atestados_id = at.id
             AND r.tp_origem = 'atestado'
             AND r.status = 'assinada'
        WHERE at.id = :id
          AND at.ds_status = 'ativo'
          AND REPLACE(REPLACE(REPLACE(t.nu_cpf, '.', ''), '-', ''), ' ', '') = :cpf
          AND r.arquivo_s3_path IS NOT NULL
        ORDER BY r.id DESC
        LIMIT 1`,
      { replacements: { id: req.params.id, cpf }, type: QueryTypes.SELECT }
    );

    if (!registro) {
      return res.status(404).json({ success: false, message: 'Atestado assinado não encontrado.' });
    }

    const urlData = await getSignedUrlForDownload(registro.arquivo_s3_path, 3600);
    return res.json({
      success: true,
      url: urlData.url,
      expiresIn: urlData.expiresIn,
      fileName: `atestado-${registro.codigo_verificacao}.pdf`,
    });
  } catch (err) {
    console.error('GET /app/atestados/:id/pdf', err);
    return res.status(500).json({ success: false, message: 'Erro ao gerar o link do PDF: ' + err.message });
  }
});

module.exports = route;
