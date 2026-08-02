'use strict';
/*
 * AGENDA DO RESPONSÁVEL no app (meubixin-app).
 *
 * Espelha o que o Portal do Responsável já faz em /portal/agendamentos e
 * /portal/solicitar-agendamento, mas com o modelo de autenticação do APP:
 * escopo por CPF (o Portal usa JWT de escopo 'portal'; o app não envia token).
 * Mesmo padrão de /app/atestados/* e /app/prescricoes/*.
 *
 * A REGRA QUE MOLDA A FEATURE: solicitar NÃO agenda. O pedido do responsável
 * entra em `mol_agenda_solicitacao` com status 'pendente' e só vira compromisso
 * quando o veterinário aceita, na tela de Agenda do sistema web. A agenda
 * continua sob controle do profissional — por isso não existe aqui nenhuma
 * escrita em `web_agendamentos`.
 *
 *   GET  /app/agenda/responsavel/:cpf   próximos atendimentos + solicitações
 *   POST /app/agenda/solicitar          pede um horário (vira pendente p/ o vet)
 */
const express = require('express');
const route = express.Router();
const { QueryTypes } = require('sequelize');
const models = require('../../models');
const { sequelize, MolAgendaSolicitacao } = models;

const soDigitos = (v) => String(v || '').replace(/\D/g, '');

// mob_tutores.nu_cpf é BIGINT, mas há base com máscara — mesma normalização de
// /app/atestados/* e /app/prescricoes/*, para os dois casos casarem.
const CPF_SQL = `REPLACE(REPLACE(REPLACE(t.nu_cpf, '.', ''), '-', ''), ' ', '')`;

// Tipos aceitos: os mesmos do "Novo agendamento" do vet, menos vacina (dose de
// vacina é agendada pela prescrição, não pedida avulsa).
const TIPOS = ['consulta', 'retorno', 'procedimento', 'teleconsulta'];

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
    `SELECT an.id, an.mob_tutores_id
       FROM mob_animais an
       JOIN mob_tutores t ON t.id = an.mob_tutores_id
      WHERE an.id = :animalId AND ${CPF_SQL} = :cpf
      LIMIT 1`,
    { replacements: { animalId, cpf }, type: QueryTypes.SELECT }
  );
  return linha || null;
}

// GET /app/agenda/responsavel/:cpf
route.get('/app/agenda/responsavel/:cpf', async (req, res) => {
  try {
    const cpf = exigirCpf(req.params.cpf, res);
    if (!cpf) return;

    // Próximos atendimentos JÁ confirmados pelo vet.
    // A janela começa em NOW() - 1 dia (e não em NOW()) de propósito: o
    // atendimento de hoje mais cedo ainda interessa ao responsável.
    // Cancelado e faltou ficam de fora — não são "próximos".
    const agendamentos = await sequelize.query(
      `SELECT ag.id, ag.tp_agendamento, ag.dt_inicio, ag.ds_titulo, ag.ds_status,
              an.id AS animal_id, an.no_nome AS animal_nome,
              v.no_completo AS vet_nome, v.nu_crmv, v.ds_estado_crmv
         FROM web_agendamentos ag
         JOIN mob_animais an ON an.id = ag.mob_animais_id
         JOIN mob_tutores t ON t.id = an.mob_tutores_id
         LEFT JOIN web_veterinarios v ON v.id = ag.web_veterinarios_id
        WHERE ${CPF_SQL} = :cpf
          AND ag.dt_inicio >= (NOW() - INTERVAL 1 DAY)
          AND (ag.ds_status IS NULL OR ag.ds_status NOT IN ('cancelado','faltou'))
        ORDER BY ag.dt_inicio ASC
        LIMIT 30`,
      { replacements: { cpf }, type: QueryTypes.SELECT }
    );

    // Solicitações: as pendentes SEMPRE, e as já respondidas dos últimos 30
    // dias. O Portal mostra só as pendentes — aqui a recusada também aparece,
    // senão o pedido sumiria sem o responsável saber o que aconteceu com ele
    // ("acompanhamento da situação do pedido").
    const solicitacoes = await sequelize.query(
      `SELECT s.id, s.tp_agendamento, s.dt_sugerida, s.ds_motivo, s.ds_status,
              s.createdAt, s.web_agendamentos_id,
              an.id AS animal_id, an.no_nome AS animal_nome
         FROM mol_agenda_solicitacao s
         JOIN mob_animais an ON an.id = s.mob_animais_id
         JOIN mob_tutores t ON t.id = an.mob_tutores_id
        WHERE ${CPF_SQL} = :cpf
          AND (s.ds_status = 'pendente' OR s.createdAt >= (NOW() - INTERVAL 30 DAY))
        ORDER BY FIELD(s.ds_status, 'pendente') DESC, s.createdAt DESC
        LIMIT 20`,
      { replacements: { cpf }, type: QueryTypes.SELECT }
    );

    return res.json({ success: true, agendamentos, solicitacoes });
  } catch (err) {
    console.error('GET /app/agenda/responsavel/:cpf', err);
    return res.status(500).json({ success: false, message: 'Erro ao carregar a agenda: ' + err.message });
  }
});

// POST /app/agenda/solicitar
// body { cpf, mob_animais_id, tp_agendamento, dt_sugerida, ds_motivo }
route.post('/app/agenda/solicitar', async (req, res) => {
  try {
    const { cpf: cpfCorpo, mob_animais_id, tp_agendamento, dt_sugerida, ds_motivo } = req.body || {};
    const cpf = exigirCpf(cpfCorpo || req.query.cpf, res);
    if (!cpf) return;

    const animal = await animalDoTutor(mob_animais_id, cpf);
    if (!animal) {
      // 400 e não 404: para o app é erro de escolha, e a mensagem não confirma
      // a existência de um pet que não é deste responsável.
      return res.status(400).json({ success: false, message: 'Selecione um pet válido.' });
    }

    const tipo = TIPOS.includes(tp_agendamento) ? tp_agendamento : 'consulta';

    // A data chega como instante ISO/UTC (o app converte antes de enviar) — é a
    // regra desta base para escrita de data, porque a produção roda em UTC e um
    // horário "local sem fuso" era deslocado ao gravar.
    let quando = null;
    if (dt_sugerida) {
      const d = new Date(dt_sugerida);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ success: false, message: 'Data sugerida inválida.' });
      }
      quando = d;
    }

    // O vet do pet é resolvido por CRMV (mob_veterinarios ↔ web_veterinarios),
    // mesmo caminho do Portal: a solicitação precisa chegar a um vet do sistema
    // web, que é quem tem a tela para aceitar.
    const [vet] = await sequelize.query(
      `SELECT wv.id
         FROM mob_animais a
         JOIN mob_veterinarios mv ON mv.id = a.mob_veterinarios_id
         JOIN web_veterinarios wv ON wv.nu_crmv = mv.nu_crmv AND wv.ds_estado_crmv = mv.ds_estado_crmv
        WHERE a.id = :animalId
        LIMIT 1`,
      { replacements: { animalId: mob_animais_id }, type: QueryTypes.SELECT }
    );

    if (!vet) {
      return res.status(400).json({
        success: false,
        message: 'Não encontramos o veterinário deste pet. Fale com a clínica para vincular o profissional.',
      });
    }

    // Uma solicitação pendente por pet já basta: sem isso, tocar duas vezes no
    // botão abriria dois pedidos iguais na fila do veterinário.
    const [pendente] = await sequelize.query(
      `SELECT id FROM mol_agenda_solicitacao
        WHERE mob_animais_id = :animalId AND ds_status = 'pendente'
        LIMIT 1`,
      { replacements: { animalId: mob_animais_id }, type: QueryTypes.SELECT }
    );
    if (pendente) {
      return res.status(409).json({
        success: false,
        message: 'Já existe um pedido de horário aguardando resposta para este pet.',
      });
    }

    const criada = await MolAgendaSolicitacao.create({
      mob_animais_id,
      web_veterinarios_id: vet.id,
      mob_tutores_id: animal.mob_tutores_id,
      tp_agendamento: tipo,
      dt_sugerida: quando,
      ds_motivo: String(ds_motivo || '').slice(0, 255) || null,
      ds_status: 'pendente',
    });

    return res.json({ success: true, id: criada.id });
  } catch (err) {
    console.error('POST /app/agenda/solicitar', err);
    return res.status(500).json({ success: false, message: 'Erro ao solicitar horário: ' + err.message });
  }
});

module.exports = route;
