const express = require('express');
const route = express.Router();
const models = require('../../models');
const { Mob_medicamentos, Mob_medicamentos_agenda, Mob_tipo_via_administracao } = models;

const moment = require('moment');

// Criar um novo medicamento com agendamentos
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
      ho_administracao_medicamento
    });

    // Criação dos registros em mob_medicamentos_agenda
    const agendas = [];
    
    // SOLUÇÃO 1: Usando string direta (mais confiável)
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    
    // Criar primeira administração como string no formato YYYY-MM-DD HH:MM:SS
    const primeiraAdministracaoString = `${ano}-${mes}-${dia} ${ho_administracao_medicamento}:00`;
    
    console.log('Data string criada:', primeiraAdministracaoString);
    
    // Primeira administração (hoje) - MARCADA COMO CONCLUÍDA
    agendas.push({
      mob_medicamentos_id: novoMedicamento.id,
      dt_administracao: primeiraAdministracaoString, // Usar string diretamente
      st_concluido: 1, // ✅ PRIMEIRA ADMINISTRAÇÃO JÁ CONCLUÍDA
    });

    // Agendamentos seguintes (não concluídos)
    for (let i = 2; i <= nu_reagendamentos; i++) {
      // Calcular próxima data usando moment mas forçando local
      const proximaData = moment(primeiraAdministracaoString)
        .add(ds_intervalo_administracao * (i - 1), 'hours')
        .format('YYYY-MM-DD HH:mm:ss');
      
      console.log(`${i}ª administração:`, proximaData);
      
      agendas.push({
        mob_medicamentos_id: novoMedicamento.id,
        dt_administracao: proximaData, // Usar string formatada
        st_concluido: 0, // Próximas administrações não concluídas
      });
    }

    // Criar os registros em mob_medicamentos_agenda em lote
    await Mob_medicamentos_agenda.bulkCreate(agendas);

    // Log para debug
    console.log('Agendas criadas:', JSON.stringify(agendas, null, 2));

    // Retornar o novo registro criado
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
    // Buscar todas as agendas relacionadas ao medicamento
    const agendas = await Mob_medicamentos_agenda.findAll({
      where: { mob_medicamentos_id },

      order: [['dt_administracao', 'ASC']]
    });

    return res.status(200).json(agendas);
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
route.put('/medicamentos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      no_medicamento, 
      mob_tipo_via_administracao_id, 
      ds_dosagem, 
      ds_observacao, 
      ds_intervalo_administracao, 
      ho_administracao_medicamento 
    } = req.body;
    
    const [updatedRows] = await Mob_medicamentos.update({
      no_medicamento,
      mob_tipo_via_administracao_id,
      ds_dosagem,
      ds_observacao,
      ds_intervalo_administracao,
      ho_administracao_medicamento
    }, { where: { id } });
    
    updatedRows ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /medicamentos/:id');
    console.log(error.message);
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