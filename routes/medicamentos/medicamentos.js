const express = require('express');
const route = express.Router();
const models = require('../../models');
const { Mob_medicamentos, Mob_medicamentos_agenda, Mob_tipo_via_administracao } = models;

const moment = require('moment-timezone'); // ← ALTERAR NO TOPO DO ARQUIVO

route.post('/medicamentos', async (req, res) => {
  const {
    mob_animal_id,
    no_medicamento,
    mob_tipo_via_administracao_id,
    ds_dosagem,
    ds_observacao,
    ds_intervalo_administracao,
    ho_administracao_medicamento,
    nu_reagendamentos
  } = req.body;

  try {
    // Validação básica
    if (!mob_animal_id || !no_medicamento || !mob_tipo_via_administracao_id ||
      !ds_dosagem || ds_intervalo_administracao == null ||
      !ho_administracao_medicamento || nu_reagendamentos == null) {
      return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }

    // Criar o registro do medicamento
    const novoMedicamento = await Mob_medicamentos.create({
      mob_animal_id,
      no_medicamento,
      mob_tipo_via_administracao_id,
      ds_dosagem,
      ds_observacao,
      ds_intervalo_administracao,
      ho_administracao_medicamento,
      nu_doses: nu_reagendamentos
    });

    // ✅ SOLUÇÃO: Usar moment-timezone com timezone de São Paulo
    const timezone = 'America/Sao_Paulo';

    // Pegar a data de hoje no timezone correto
    const hoje = moment.tz(timezone).format('YYYY-MM-DD');

    // Criar a primeira administração combinando a data de hoje com o horário informado
    const primeiraAdministracao = moment.tz(
      `${hoje} ${ho_administracao_medicamento}`,
      'YYYY-MM-DD HH:mm',
      timezone
    ).add(3, 'hours'); // ← ADICIONAR ISSO AQUI

    console.log('📅 Data de hoje (timezone Brasil):', hoje);
    console.log('⏰ Horário informado:', ho_administracao_medicamento);
    console.log('✅ Primeira administração:', primeiraAdministracao.format('YYYY-MM-DD HH:mm:ss'));

    const agendas = [];

    // Primeira administração (hoje) - MARCADA COMO CONCLUÍDA
    agendas.push({
      mob_medicamentos_id: novoMedicamento.id,
      dt_administracao: primeiraAdministracao.format('YYYY-MM-DD HH:mm:ss'),
      st_concluido: 1,
    });

    // Agendamentos seguintes (não concluídos)
    for (let i = 2; i <= nu_reagendamentos; i++) {
      const proximaAdministracao = primeiraAdministracao.clone()
        .add(ds_intervalo_administracao * (i - 1), 'hours');

      console.log(`${i}ª administração:`, proximaAdministracao.format('YYYY-MM-DD HH:mm:ss'));

      agendas.push({
        mob_medicamentos_id: novoMedicamento.id,
        dt_administracao: proximaAdministracao.format('YYYY-MM-DD HH:mm:ss'),
        st_concluido: 0,
      });
    }

    // Criar os registros em mob_medicamentos_agenda em lote
    await Mob_medicamentos_agenda.bulkCreate(agendas);

    console.log('✅ Agendas criadas com sucesso!');

    return res.status(201).json(novoMedicamento);
  } catch (error) {
    console.error('Erro ao criar medicamento:', error);
    return res.status(500).json({ message: 'Erro ao criar medicamento.', error });
  }
});


// Atualizar status de conclusão da agenda
route.put("/medicamentos-agenda/:agenda_id/concluir", async (req, res) => {
  try {
    const { agenda_id } = req.params;
    const { st_concluido } = req.body;

    const [updatedRows] = await Mob_medicamentos_agenda.update(
      { st_concluido },
      { where: { id: agenda_id } }
    );

    if (updatedRows === 0) {
      return res.status(404).send({ error: "Agenda não encontrada" });
    }

    res.status(200).send({ message: "Agenda atualizada com sucesso" });
  } catch (error) {
    console.log("ERRO em /medicamentos-agenda/:agenda_id/concluir");
    console.log(error.message);
    res.status(500).send({ error: "Erro ao atualizar a agenda" });
  }
});

// Buscar medicamentos por animal
route.get('/medicamentos/:mob_animal_id', async (req, res) => {
  const { mob_animal_id } = req.params;

  try {
    // Buscar medicamentos para o animal específico
    const medicamentos = await Mob_medicamentos.findAll({
      where: { mob_animal_id }
    });

    return res.status(200).json(medicamentos);
  } catch (error) {
    console.error('Erro ao buscar medicamentos:', error);
    return res.status(500).json({ message: 'Erro ao buscar medicamentos.', error });
  }
});


// Buscar agendas de um medicamento específico
route.get('/medicamentos/:mob_medicamentos_id/agendas', async (req, res) => {
  const { mob_medicamentos_id } = req.params;

  try {
    const agendas = await Mob_medicamentos_agenda.findAll({
      where: { mob_medicamentos_id },
      order: [['dt_administracao', 'ASC']]
    });

    // ✅ Subtrair 3 horas para compensar a conversão do frontend
    const agendasCorrigidas = agendas.map(agenda => {
      const agendaObj = agenda.toJSON();
      
      const dataCorrigida = moment(agendaObj.dt_administracao)
        .subtract(3, 'hours')
        .format('YYYY-MM-DD HH:mm:ss');
      
      return {
        ...agendaObj,
        dt_administracao: dataCorrigida
      };
    });

    return res.status(200).json(agendasCorrigidas);
  } catch (error) {
    console.error('Erro ao buscar agendas:', error);
    return res.status(500).json({ message: 'Erro ao buscar agendas.', error });
  }
});

// Deletar medicamento e suas agendas
route.delete("/medicamentos/:medicamento_id", async (req, res) => {
  try {
    const { medicamento_id } = req.params;

    // Excluir todas as agendas associadas ao medicamento
    await Mob_medicamentos_agenda.destroy({
      where: { mob_medicamentos_id: medicamento_id },
    });

    // Excluir o medicamento
    const deletedMedicamento = await Mob_medicamentos.destroy({
      where: { id: medicamento_id },
    });

    if (deletedMedicamento === 0) {
      return res.status(404).send({ error: "Medicamento não encontrado" });
    }

    res.status(200).send({ message: "Medicamento deletado com sucesso" });
  } catch (error) {
    console.log("ERRO em /medicamentos/:medicamento_id");
    console.log(error.message);
    res.status(500).send({ error: "Erro ao deletar o medicamento" });
  }
});

// Buscar tipos de via de administração
route.get('/tipos-via-administracao', async (req, res) => {
  try {
    const tiposVia = await Mob_tipo_via_administracao.findAll();
    return res.status(200).json(tiposVia);
  } catch (error) {
    console.error('Erro ao buscar tipos de via de administração:', error);
    return res.status(500).json({ message: 'Erro ao buscar tipos de via de administração.', error });
  }
});

// Buscar medicamento específico por ID
route.get('/medicamento/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const medicamento = await Mob_medicamentos.findOne({
      where: { id },
      include: [
        {
          model: models.Mob_tipo_via_administracao,
          as: 'tipoViaAdministracao'
        }
      ]
    });

    medicamento ? res.send(medicamento) : res.send(false);
  } catch (error) {
    console.log('ERRO em /medicamento/:id');
    console.log(error.message);
    res.status(500).send({ error: "Erro ao buscar medicamento" });
  }
});

// Atualizar medicamento
// Atualizar medicamento com recriação das agendas
route.put('/medicamentos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      no_medicamento,
      mob_tipo_via_administracao_id,
      ds_dosagem,
      ds_observacao,
      ds_intervalo_administracao,
      ho_administracao_medicamento,
      nu_reagendamentos // ← NOVO CAMPO
    } = req.body;
    console.log('cheguei na edição')

    // Buscar o medicamento atual para obter dados anteriores
    const medicamentoAtual = await Mob_medicamentos.findOne({ where: { id } });

    if (!medicamentoAtual) {
      return res.status(404).json({ message: 'Medicamento não encontrado' });
    }

    // Atualizar o registro principal do medicamento
    const [updatedRows] = await Mob_medicamentos.update({
      no_medicamento,
      mob_tipo_via_administracao_id,
      ds_dosagem,
      ds_observacao,
      ds_intervalo_administracao,
      ho_administracao_medicamento,
      nu_doses: nu_reagendamentos || medicamentoAtual.nu_doses // Usar o novo valor ou manter o atual
    }, { where: { id } });


    // Verificar se houve mudança no horário inicial, intervalo ou número de doses
    const houveMudancaAgenda = (
      ho_administracao_medicamento !== medicamentoAtual.ho_administracao_medicamento ||
      ds_intervalo_administracao !== medicamentoAtual.ds_intervalo_administracao ||
      (nu_reagendamentos && nu_reagendamentos !== medicamentoAtual.nu_doses)
    );

    // Se houve mudança que afeta as agendas, recriar todas as agendas
    if (houveMudancaAgenda) {
      console.log('🔄 Recriando agendas devido a mudanças no horário, intervalo ou número de doses');

      // 1. Buscar agendas existentes para verificar quais já foram concluídas
      const agendasExistentes = await Mob_medicamentos_agenda.findAll({
        where: { mob_medicamentos_id: id },
        order: [['dt_administracao', 'ASC']]
      });

      // 2. Deletar todas as agendas existentes (concluídas e pendentes)
      await Mob_medicamentos_agenda.destroy({
        where: { mob_medicamentos_id: id }
      });

      // 3. Recriar as agendas com os novos parâmetros
      // 3. Recriar as agendas com os novos parâmetros
      const agendas = [];
      const totalDoses = nu_reagendamentos || medicamentoAtual.nu_doses;

      // ✅ Usar moment-timezone
      const timezone = 'America/Sao_Paulo';
      const hoje = moment.tz(timezone).format('YYYY-MM-DD');

      const primeiraAdministracao = moment.tz(
        `${hoje} ${ho_administracao_medicamento}`,
        'YYYY-MM-DD HH:mm',
        timezone
      ).add(3, 'hours'); // ← ADICIONAR ISSO AQUI

      console.log('📅 Nova primeira administração:', primeiraAdministracao.format('YYYY-MM-DD HH:mm:ss'));

      // Verificar quantas doses já foram administradas na prática
      const dosesJaConcluidas = agendasExistentes.filter(agenda => agenda.st_concluido === 1).length;

      // Criar as agendas
      for (let i = 1; i <= totalDoses; i++) {
        const proximaAdministracao = primeiraAdministracao.clone()
          .add(ds_intervalo_administracao * (i - 1), 'hours');

        const jaConcluida = i <= dosesJaConcluidas ? 1 : 0;

        agendas.push({
          mob_medicamentos_id: id,
          dt_administracao: proximaAdministracao.format('YYYY-MM-DD HH:mm:ss'),
          st_concluido: jaConcluida
        });

        console.log(`📋 ${i}ª dose: ${proximaAdministracao.format('YYYY-MM-DD HH:mm:ss')} - ${jaConcluida ? 'Concluída' : 'Pendente'}`);
      }

      // Criar os novos registros
      await Mob_medicamentos_agenda.bulkCreate(agendas);

      console.log('✅ Agendas recriadas com sucesso');
    }

    res.status(200).json({
      message: 'Medicamento atualizado com sucesso',
      agendasRecriadas: houveMudancaAgenda
    });

  } catch (error) {
    console.log('ERRO em /medicamentos/:id');
    console.log(error);
    res.status(500).send({ error: "Erro ao atualizar medicamento" });
  }
});

// Buscar agendas pendentes por animal
route.get('/agendas-pendentes/:mob_animal_id', async (req, res) => {
  const { mob_animal_id } = req.params;

  try {
    const agendasPendentes = await Mob_medicamentos_agenda.findAll({
      where: { st_concluido: 0 },
      include: [
        {
          model: models.Mob_medicamentos,
          as: 'medicamento',
          where: { mob_animal_id },
          include: [
            {
              model: models.Mob_tipo_via_administracao,
              as: 'tipoViaAdministracao'
            }
          ]
        }
      ],
      order: [['dt_administracao', 'ASC']]
    });

    return res.status(200).json(agendasPendentes);
  } catch (error) {
    console.error('Erro ao buscar agendas pendentes:', error);
    return res.status(500).json({ message: 'Erro ao buscar agendas pendentes.', error });
  }
});

module.exports = route;