'use strict';
/*
 * RECEITA / PRESCRIÇÕES no app do RESPONSÁVEL (meubixin-app).
 *
 * Por que este arquivo existe: as telas Prescricoes.jsx e DetalhesPrescricao.jsx
 * do app chamavam SEIS endpoints que nunca existiram no backend
 * (/prescricoes/assinadas/animal/:id, /prescricoes/:id/detalhes,
 *  /prescricao/protocolos/anamnese/:id, /prescricoes/doses/:id,
 *  /prescricao/doses/:id/status, /prescricoes/:id/pdf). A funcionalidade estava
 * inteira do lado do app e inteiramente morta do lado do servidor.
 *
 * Optou-se por um router /app/ próprio, e não por apelidos nas rotas do web, por
 * três motivos: (a) o app precisa de um FORMATO diferente (doses agrupadas por
 * protocolo, contadores prontos, status derivado) — as rotas do vet devolvem o
 * shape que o web usa; (b) as rotas do web não são escopadas por responsável;
 * (c) já existe o precedente /app/atestados/*, e este arquivo o espelha.
 *
 * AUTENTICAÇÃO: escopo por CPF, o mesmo modelo de /app/atestados/* e de
 * `GET /animalCpf/:nu_cpf`, porque o app não envia token.
 * ⚠️ Quem souber um CPF vê as receitas daquele responsável. Não é um vazamento
 * novo — é o nível de todas as rotas do app —, mas é o ponto a endurecer quando
 * o app passar a mandar o token do Clerk (o Portal já faz isso via JWT 'portal').
 * Por isso TODA rota aqui confere o vínculo pet↔tutor: sem isso, trocar o número
 * na URL daria acesso à receita de qualquer paciente.
 *
 * Só devolve prescrições ASSINADAS: receita sem assinatura digital não tem valor
 * e não pode chegar ao responsável como se tivesse (mesma regra do atestado).
 *
 *   GET /app/prescricoes/animal/:animalId?cpf=      receitas assinadas do pet
 *   GET /app/prescricoes/doses/:doseId?cpf=         uma dose
 *   PUT /app/prescricoes/doses/:doseId/status?cpf=  concluir / desmarcar dose
 *   GET /app/prescricoes/:anamneseId/detalhes?cpf=  veterinário + assinatura
 *   GET /app/prescricoes/:anamneseId/protocolos?cpf= protocolos com as doses
 *   GET /app/prescricoes/:anamneseId/pdf?cpf=       URL assinada do PDF (S3)
 */
const express = require('express');
const route = express.Router();
const { QueryTypes } = require('sequelize');
const models = require('../../models');
const { sequelize } = models;
const { getSignedUrlForDownload } = require('../../utils/s3_teste');

const soDigitos = (v) => String(v || '').replace(/\D/g, '');

// mob_tutores.nu_cpf é BIGINT, mas há base com máscara — mesma normalização
// usada em /app/atestados/*, para os dois casos casarem.
const CPF_SQL = `REPLACE(REPLACE(REPLACE(t.nu_cpf, '.', ''), '-', ''), ' ', '')`;

// "Hoje" no fuso de Brasília. O servidor roda em UTC na Vercel: usar
// getDate()/toLocale* sem timeZone marcaria doses como atrasadas até 3h antes
// da hora — o mesmo bug de fuso que esta base já shipou duas vezes.
const FMT_YMD = new Intl.DateTimeFormat('en-CA', {
  timeZone: process.env.APP_TZ || 'America/Sao_Paulo',
  year: 'numeric', month: '2-digit', day: '2-digit',
});
const ymd = (d) => FMT_YMD.format(d instanceof Date ? d : new Date(d));

/* ------------------------------------------------------------------ *
 * Guardas de propriedade — o id vem do cliente, então nada é confiável *
 * ------------------------------------------------------------------ */

async function animalDoTutor(animalId, cpf) {
  const [linha] = await sequelize.query(
    `SELECT an.id
       FROM mob_animais an
       JOIN mob_tutores t ON t.id = an.mob_tutores_id
      WHERE an.id = :animalId AND ${CPF_SQL} = :cpf
      LIMIT 1`,
    { replacements: { animalId, cpf }, type: QueryTypes.SELECT }
  );
  return !!linha;
}

async function anamneseDoTutor(anamneseId, cpf) {
  const [linha] = await sequelize.query(
    `SELECT a.id
       FROM web_anamneses a
       JOIN mob_animais an ON an.id = a.mob_animais_id
       JOIN mob_tutores t ON t.id = an.mob_tutores_id
      WHERE a.id = :anamneseId AND ${CPF_SQL} = :cpf
      LIMIT 1`,
    { replacements: { anamneseId, cpf }, type: QueryTypes.SELECT }
  );
  return !!linha;
}

async function doseDoTutor(doseId, cpf) {
  const [linha] = await sequelize.query(
    `SELECT pa.id
       FROM web_protocolos_agendas pa
       JOIN web_protocolos p ON p.id = pa.web_protocolos_id
       JOIN web_anamneses a ON a.id = p.web_anamneses_id
       JOIN mob_animais an ON an.id = a.mob_animais_id
       JOIN mob_tutores t ON t.id = an.mob_tutores_id
      WHERE pa.id = :doseId AND ${CPF_SQL} = :cpf
      LIMIT 1`,
    { replacements: { doseId, cpf }, type: QueryTypes.SELECT }
  );
  return !!linha;
}

// Lê e valida o CPF; responde e devolve null quando ausente.
function exigirCpf(req, res) {
  const cpf = soDigitos(req.query.cpf);
  if (!cpf) {
    res.status(400).json({ success: false, message: 'Informe o CPF do responsável.' });
    return null;
  }
  return cpf;
}

/* ------------------------------------------------------------------ *
 * Rotas de DOSE — registradas ANTES das de /:anamneseId por convenção  *
 * desta base (evita que um segmento literal seja lido como parâmetro). *
 * ------------------------------------------------------------------ */

// GET /app/prescricoes/doses/:doseId?cpf=
route.get('/app/prescricoes/doses/:doseId', async (req, res) => {
  try {
    const cpf = exigirCpf(req, res);
    if (!cpf) return;

    const { doseId } = req.params;
    if (!(await doseDoTutor(doseId, cpf))) {
      return res.status(404).json({ success: false, message: 'Dose não encontrada.' });
    }

    const [dose] = await sequelize.query(
      `SELECT pa.id, pa.web_protocolos_id, pa.dt_data_aplicacao, pa.st_concluido,
              pa.ds_lote, pa.ds_fabricante, pa.dt_validade_vacina, pa.ds_via_aplicacao,
              COALESCE(p.nome_protocolo, ps.ds_protocolos_saude) AS nome_protocolo,
              p.st_tipo_protocolo
         FROM web_protocolos_agendas pa
         JOIN web_protocolos p ON p.id = pa.web_protocolos_id
         LEFT JOIN web_protocolos_saude ps ON ps.id = p.web_protocolos_saude_id
        WHERE pa.id = :doseId
        LIMIT 1`,
      { replacements: { doseId }, type: QueryTypes.SELECT }
    );

    return res.json({
      success: true,
      data: { ...dose, st_concluido: Number(dose.st_concluido) ? 1 : 0 },
    });
  } catch (err) {
    console.error('GET /app/prescricoes/doses/:doseId', err);
    return res.status(500).json({ success: false, message: 'Erro ao buscar a dose: ' + err.message });
  }
});

// PUT /app/prescricoes/doses/:doseId/status?cpf=   body { st_concluido: 0|1 }
// É a única rota de ESCRITA do app aqui: o responsável marca que aplicou a dose.
route.put('/app/prescricoes/doses/:doseId/status', async (req, res) => {
  try {
    const cpf = exigirCpf(req, res);
    if (!cpf) return;

    const { doseId } = req.params;
    const { st_concluido } = req.body || {};

    // Aceita 0/1, true/false e "1"/"0" — o app manda número, mas não custa.
    if (st_concluido === undefined || st_concluido === null) {
      return res.status(400).json({ success: false, message: 'Informe st_concluido.' });
    }
    const valor = Number(st_concluido) ? 1 : 0;

    if (!(await doseDoTutor(doseId, cpf))) {
      return res.status(404).json({ success: false, message: 'Dose não encontrada.' });
    }

    await sequelize.query(
      `UPDATE web_protocolos_agendas SET st_concluido = :valor WHERE id = :doseId`,
      { replacements: { valor, doseId }, type: QueryTypes.UPDATE }
    );

    return res.json({ success: true, id: Number(doseId), st_concluido: valor });
  } catch (err) {
    console.error('PUT /app/prescricoes/doses/:doseId/status', err);
    return res.status(500).json({ success: false, message: 'Erro ao atualizar a dose: ' + err.message });
  }
});

/* ------------------------------------------------------------------ *
 * Lista de receitas do pet                                            *
 * ------------------------------------------------------------------ */

// GET /app/prescricoes/animal/:animalId?cpf=
route.get('/app/prescricoes/animal/:animalId', async (req, res) => {
  try {
    const cpf = exigirCpf(req, res);
    if (!cpf) return;

    const { animalId } = req.params;
    if (!(await animalDoTutor(animalId, cpf))) {
      // 404, não 403: não confirma a existência do pet para quem não é o tutor.
      return res.status(404).json({ success: false, message: 'Paciente não encontrado.' });
    }

    // Uma linha por dose; agrupado em memória. O INNER JOIN em
    // web_registros_prescricoes é o que restringe a receitas ASSINADAS.
    const linhas = await sequelize.query(
      `SELECT a.id AS anamnese_id,
              a.dt_data_anamnese,
              a.ds_orientacoes,
              r.codigo_verificacao,
              r.dt_assinatura,
              p.id AS protocolo_id,
              COALESCE(p.nome_protocolo, ps.ds_protocolos_saude) AS nome_protocolo,
              p.st_tipo_protocolo,
              pa.id AS dose_id,
              pa.dt_data_aplicacao,
              pa.st_concluido
         FROM web_anamneses a
         JOIN mob_animais an ON an.id = a.mob_animais_id
         JOIN mob_tutores t ON t.id = an.mob_tutores_id
         JOIN web_registros_prescricoes r
              ON r.web_anamneses_id = a.id
             AND r.tp_origem = 'prescricao'
             AND r.status = 'assinada'
         LEFT JOIN web_protocolos p ON p.web_anamneses_id = a.id
         LEFT JOIN web_protocolos_saude ps ON ps.id = p.web_protocolos_saude_id
         LEFT JOIN web_protocolos_agendas pa ON pa.web_protocolos_id = p.id
        WHERE a.mob_animais_id = :animalId
          AND ${CPF_SQL} = :cpf
        ORDER BY r.dt_assinatura DESC, a.dt_data_anamnese DESC, p.id ASC, pa.dt_data_aplicacao ASC`,
      { replacements: { animalId, cpf }, type: QueryTypes.SELECT }
    );

    const hoje = ymd(new Date());
    const mapa = new Map();

    for (const l of linhas) {
      if (!mapa.has(l.anamnese_id)) {
        mapa.set(l.anamnese_id, {
          id: l.anamnese_id,
          anamnese_id: l.anamnese_id,
          dt_data: l.dt_data_anamnese,
          codigo_verificacao: l.codigo_verificacao,
          dt_assinatura: l.dt_assinatura,
          observacoes: l.ds_orientacoes || null,
          protocolos: [],
          _idsProtocolo: new Set(),
          _atrasada: false,
          progresso: { totalDoses: 0, dosesAplicadas: 0, percentual: 0 },
        });
      }
      const rx = mapa.get(l.anamnese_id);

      if (l.protocolo_id && !rx._idsProtocolo.has(l.protocolo_id)) {
        rx._idsProtocolo.add(l.protocolo_id);
        rx.protocolos.push({
          id: l.protocolo_id,
          nome_protocolo: l.nome_protocolo || 'Protocolo não identificado',
          st_tipo_protocolo: l.st_tipo_protocolo,
        });
      }

      if (l.dose_id) {
        const concluida = !!Number(l.st_concluido);
        rx.progresso.totalDoses += 1;
        if (concluida) rx.progresso.dosesAplicadas += 1;
        // Atrasada = dose pendente com data já passada (comparação por dia, em
        // Brasília: a dose de hoje ainda não está atrasada).
        else if (l.dt_data_aplicacao && ymd(l.dt_data_aplicacao) < hoje) rx._atrasada = true;
      }
    }

    const prescricoes = [...mapa.values()].map((rx) => {
      const { totalDoses, dosesAplicadas } = rx.progresso;
      rx.progresso.percentual = totalDoses ? Math.round((dosesAplicadas / totalDoses) * 100) : 0;

      // Rótulos esperados pelo switch de Prescricoes.jsx.
      let status;
      if (totalDoses > 0 && dosesAplicadas === totalDoses) status = 'finalizada';
      else if (rx._atrasada) status = 'atrasada';
      else if (dosesAplicadas > 0) status = 'em_andamento';
      else status = 'ativa';

      delete rx._idsProtocolo;
      delete rx._atrasada;
      return { ...rx, status };
    });

    return res.json({ success: true, total: prescricoes.length, prescricoes });
  } catch (err) {
    console.error('GET /app/prescricoes/animal/:animalId', err);
    return res.status(500).json({ success: false, message: 'Erro ao listar receitas: ' + err.message });
  }
});

/* ------------------------------------------------------------------ *
 * Detalhe de uma receita                                              *
 * ------------------------------------------------------------------ */

// GET /app/prescricoes/:anamneseId/detalhes?cpf=
route.get('/app/prescricoes/:anamneseId/detalhes', async (req, res) => {
  try {
    const cpf = exigirCpf(req, res);
    if (!cpf) return;

    const { anamneseId } = req.params;
    if (!(await anamneseDoTutor(anamneseId, cpf))) {
      return res.status(404).json({ success: false, message: 'Receita não encontrada.' });
    }

    const [linha] = await sequelize.query(
      `SELECT a.id AS anamnese_id, a.dt_data_anamnese, a.ds_orientacoes,
              r.codigo_verificacao, r.dt_assinatura, r.status,
              v.no_completo AS veterinario_nome,
              v.nu_crmv AS veterinario_crmv,
              v.ds_estado_crmv AS veterinario_uf_crmv,
              v.nu_telefone_completo AS veterinario_telefone,
              v.ds_email AS veterinario_email
         FROM web_anamneses a
         JOIN web_registros_prescricoes r
              ON r.web_anamneses_id = a.id
             AND r.tp_origem = 'prescricao'
             AND r.status = 'assinada'
         LEFT JOIN web_veterinarios v ON v.id = a.web_veterinarios_id
        WHERE a.id = :anamneseId
        ORDER BY r.dt_assinatura DESC
        LIMIT 1`,
      { replacements: { anamneseId }, type: QueryTypes.SELECT }
    );

    if (!linha) {
      return res.status(404).json({ success: false, message: 'Receita assinada não encontrada.' });
    }

    return res.json({ success: true, data: linha });
  } catch (err) {
    console.error('GET /app/prescricoes/:anamneseId/detalhes', err);
    return res.status(500).json({ success: false, message: 'Erro ao buscar a receita: ' + err.message });
  }
});

// GET /app/prescricoes/:anamneseId/protocolos?cpf=
// Devolve os protocolos JÁ com as doses aninhadas e os contadores prontos — a
// tela do app só desenha. As rotas do web devolvem `agendas` sem contagem, o
// que obrigaria o app a recalcular.
route.get('/app/prescricoes/:anamneseId/protocolos', async (req, res) => {
  try {
    const cpf = exigirCpf(req, res);
    if (!cpf) return;

    const { anamneseId } = req.params;
    if (!(await anamneseDoTutor(anamneseId, cpf))) {
      return res.status(404).json({ success: false, message: 'Receita não encontrada.' });
    }

    const linhas = await sequelize.query(
      `SELECT p.id AS protocolo_id,
              COALESCE(p.nome_protocolo, ps.ds_protocolos_saude) AS nome_protocolo,
              p.st_tipo_protocolo, p.st_uso_humano, p.ds_dosagem,
              p.ds_concentracao, p.ds_forma_farmaceutica, p.ds_quantidade,
              p.ds_via_administracao, p.nu_doses, p.nu_intervalo_uso, p.tipo_intervalo_uso,
              pa.id AS dose_id, pa.dt_data_aplicacao, pa.st_concluido,
              pa.ds_lote, pa.ds_fabricante, pa.dt_validade_vacina, pa.ds_via_aplicacao
         FROM web_protocolos p
         LEFT JOIN web_protocolos_saude ps ON ps.id = p.web_protocolos_saude_id
         LEFT JOIN web_protocolos_agendas pa ON pa.web_protocolos_id = p.id
        WHERE p.web_anamneses_id = :anamneseId
        ORDER BY p.id ASC, pa.dt_data_aplicacao ASC`,
      { replacements: { anamneseId }, type: QueryTypes.SELECT }
    );

    const mapa = new Map();
    for (const l of linhas) {
      if (!mapa.has(l.protocolo_id)) {
        mapa.set(l.protocolo_id, {
          id: l.protocolo_id,
          nome_protocolo: l.nome_protocolo || 'Protocolo não identificado',
          st_tipo_protocolo: l.st_tipo_protocolo,
          st_uso_humano: Number(l.st_uso_humano) ? 1 : 0,
          ds_dosagem: l.ds_dosagem,
          ds_concentracao: l.ds_concentracao,
          ds_forma_farmaceutica: l.ds_forma_farmaceutica,
          ds_quantidade: l.ds_quantidade,
          ds_via_administracao: l.ds_via_administracao,
          nu_doses: l.nu_doses,
          nu_intervalo_uso: l.nu_intervalo_uso,
          tipo_intervalo_uso: l.tipo_intervalo_uso,
          doses: [],
          total_doses: 0,
          doses_concluidas: 0,
        });
      }
      const p = mapa.get(l.protocolo_id);

      // LEFT JOIN: protocolo sem cronograma vem com dose_id nulo.
      if (l.dose_id) {
        const concluida = Number(l.st_concluido) ? 1 : 0;
        p.doses.push({
          id: l.dose_id,
          dt_data_aplicacao: l.dt_data_aplicacao,
          st_concluido: concluida,
          ds_lote: l.ds_lote,
          ds_fabricante: l.ds_fabricante,
          dt_validade_vacina: l.dt_validade_vacina,
          ds_via_aplicacao: l.ds_via_aplicacao,
        });
        p.total_doses += 1;
        if (concluida) p.doses_concluidas += 1;
      }
    }

    // Array puro: é o que a tela espera (ela faz Array.isArray no retorno).
    return res.json([...mapa.values()]);
  } catch (err) {
    console.error('GET /app/prescricoes/:anamneseId/protocolos', err);
    return res.status(500).json({ success: false, message: 'Erro ao buscar os protocolos: ' + err.message });
  }
});

// GET /app/prescricoes/:anamneseId/pdf?cpf=&expiresIn=
// A URL do S3 é temporária — por isso é pedida no toque, não junto da lista
// (mesma razão documentada em /app/atestados/:id/pdf).
route.get('/app/prescricoes/:anamneseId/pdf', async (req, res) => {
  try {
    const cpf = exigirCpf(req, res);
    if (!cpf) return;

    const { anamneseId } = req.params;
    const expiresIn = parseInt(req.query.expiresIn, 10) || 3600;

    if (!(await anamneseDoTutor(anamneseId, cpf))) {
      return res.status(404).json({ success: false, message: 'Receita não encontrada.' });
    }

    const [registro] = await sequelize.query(
      `SELECT r.arquivo_s3_path, r.codigo_verificacao
         FROM web_registros_prescricoes r
        WHERE r.web_anamneses_id = :anamneseId
          AND r.tp_origem = 'prescricao'
          AND r.status = 'assinada'
          AND r.arquivo_s3_path IS NOT NULL
        ORDER BY r.id DESC
        LIMIT 1`,
      { replacements: { anamneseId }, type: QueryTypes.SELECT }
    );

    if (!registro) {
      return res.status(404).json({ success: false, message: 'Receita assinada não encontrada.' });
    }

    const urlData = await getSignedUrlForDownload(registro.arquivo_s3_path, expiresIn);
    return res.json({
      success: true,
      url: urlData.url,
      expiresIn: urlData.expiresIn,
      fileName: `receita-${registro.codigo_verificacao}.pdf`,
      codigoVerificacao: registro.codigo_verificacao,
    });
  } catch (err) {
    console.error('GET /app/prescricoes/:anamneseId/pdf', err);
    return res.status(500).json({ success: false, message: 'Erro ao gerar o link do PDF: ' + err.message });
  }
});

module.exports = route;
