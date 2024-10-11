const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_manejo, mob_manejos_higiene, mob_tipo_higienes, mob_manejos_higiene_agenda } = models;

const moment = require('moment');


route.post('/manejos-higiene', async (req, res) => {
  const { mob_animal_id, tipo_manejos_higiene_id, nu_reagendamentos, nu_intervalo_dias } = req.body;

  try {
    // Validação básica
    if (!mob_animal_id || !tipo_manejos_higiene_id || nu_reagendamentos == null || nu_intervalo_dias == null) {
      return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }

    // Criar o registro de manejo de higiene
    const novoManejo = await mob_manejos_higiene.create({
      mob_animal_id,
      tipo_manejos_higiene_id,
      nu_reagendamentos,
      nu_intervalo_dias,
    });

    // Criação dos registros em mob_manejos_higiene_agenda
    const agendas = [];
    const dataAtual = new Date(); // Data inicial

    // Primeira agenda (hoje)
    agendas.push({
      mob_manejos_higiene_id: novoManejo.id,
      dt_higiene: new Date(dataAtual), // Atribuindo uma nova instância para a data inicial
      st_concluido: 1, // O primeiro agendamento é marcado como concluído
    });

    // Agendamentos seguintes
    for (let i = 2; i <= nu_reagendamentos; i++) {
      const dataHigiene = moment(dataAtual).add(nu_intervalo_dias * (i-1), 'days').toDate(); // Criação de uma nova data incrementada
      console.log(dataHigiene, "Data a ser inserida")
      agendas.push({
        mob_manejos_higiene_id: novoManejo.id,
        dt_higiene: dataHigiene,
        st_concluido: 0, // Marcar como não concluído
      });
    }

    // Criar os registros em mob_manejos_higiene_agenda em lote
    await mob_manejos_higiene_agenda.bulkCreate(agendas);

    // Retornar o novo registro criado
    return res.status(201).json(novoManejo);
  } catch (error) {
    console.error('Erro ao criar registro:', error);
    return res.status(500).json({ message: 'Erro ao criar registro.', error });
  }
});

route.put("/mob_higiene_agendas/:agenda_id/concluir", async (req, res) => {
  try {
    const { agenda_id } = req.params;
    const { st_concluido } = req.body;

    const [updatedRows] = await mob_manejos_higiene_agenda.update(
      { st_concluido },
      { where: { id: agenda_id } }
    );

    if (updatedRows === 0) {
      return res.status(404).send({ error: "agenda não encontrada" });
    }

    res.status(200).send({ message: "agenda atualizada com sucesso" });
  } catch (error) {
    console.log("ERRO em /mob_higiene_agendas/:agenda_id/concluir");
    console.log(error.message);
    res.status(500).send({ error: "Erro ao atualizar a agenda" });
  }
});


route.get('/manejos-higiene/:mob_animal_id', async (req, res) => {
  console.log("chegou aqui")
  const { mob_animal_id } = req.params; // Pegar o ID do animal a partir dos parâmetros da rota

  try {
    // Buscar registros de mob_manejos_higiene para o animal específico
    const manejosHigiene = await mob_manejos_higiene.findAll({
      where: { mob_animal_id }
    });

    // Retornar os registros encontrados
    return res.status(200).json(manejosHigiene);
  } catch (error) {
    console.error('Erro ao buscar registros:', error);
    return res.status(500).json({ message: 'Erro ao buscar registros.', error });
  }
});

route.get('/manejos-higiene/:mob_manejos_higiene_id/agendas', async (req, res) => {
  const { mob_manejos_higiene_id } = req.params;

  try {
    // Buscar todas as agendas relacionadas ao `mob_manejos_higiene_id`
    const agendas = await mob_manejos_higiene_agenda.findAll({
      where: { mob_manejos_higiene_id }
    });

    // Retornar as agendas encontradas
    return res.status(200).json(agendas);
  } catch (error) {
    console.error('Erro ao buscar agendas:', error);
    return res.status(500).json({ message: 'Erro ao buscar agendas.', error });
  }
});


route.delete("/mob_manejo/:manejo_id", async (req, res) => {
  try {
    const { manejo_id } = req.params;

    // Excluir todas as doses associadas ao protocolo_id fornecido
    await mob_manejos_higiene_agenda.destroy({
      where: { mob_manejos_higiene_id: manejo_id },
    });

    // Excluir o protocolo
    const deletedManejo = await mob_manejos_higiene.destroy({
      where: { id: manejo_id },
    });

    if (deletedManejo === 0) {
      return res.status(404).send({ error: "manejo não encontrado" });
    }

    res.status(200).send({ message: "manejo deletado com sucesso" });
  } catch (error) {
    console.log("ERRO em /mob_manejo/:manejo_id");
    console.log(error.message);
    res.status(500).send({ error: "Erro ao deletar o manejo" });
  }
});



route.get('/tipos-higiene', async (req, res) => {
  try {
    // Buscar todos os registros
    const tiposHigiene = await mob_tipo_higienes.findAll();

    // Retornar os registros encontrados
    return res.status(200).json(tiposHigiene);
  } catch (error) {
    console.error('Erro ao buscar registros:', error);
    return res.status(500).json({ message: 'Erro ao buscar registros.', error });
  }
});


route.get('/manejo', async (req, res) => {
  try {
    const resposta = await mob_manejo.findAll();
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_manejo');
    console.log(error.message);
  }
});

route.get('/manejoAnimaisID/:Animais_id', async (req, res) => {
  try {
    const { Animais_id } = req.params;
    const resposta = await mob_manejo.findOne({
      where: { mob_animais_id: Animais_id }
    });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /sistema_OtoTegumentarAnamneseID');
    console.log(error.message);
  }
});

route.get('/manejo/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_manejo.findOne({ where: { id } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_manejo');
    console.log(error.message);
  }
});

route.post('/manejo', async (req, res) => {
  try {
    const { mob_animais_id, mob_antecedentes_morbidos_id, ds_presenca_ectoparazitas, ds_ambiente, ds_dieta, ds_banhos, ds_vacinacao, ds_contactantes } = req.body;
    const resposta = await mob_manejo.create({ mob_animais_id, mob_antecedentes_morbidos_id, ds_presenca_ectoparazitas, ds_ambiente, ds_dieta, ds_banhos, ds_vacinacao, ds_contactantes });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_manejo');
    console.log(error.message);
  }
});

route.put('/manejo', async (req, res) => {
  try {
    const { id, mob_animais_id, mob_antecedentes_morbidos_id, ds_presenca_ectoparazitas, ds_ambiente, ds_dieta, ds_banhos, ds_vacinacao, ds_contactantes } = req.body;
    const resposta = await mob_manejo.update({ mob_animais_id, mob_antecedentes_morbidos_id, ds_presenca_ectoparazitas, ds_ambiente, ds_dieta, ds_banhos, ds_vacinacao, ds_contactantes }, { where: { id } });
    resposta[0] ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_manejo');
    console.log(error.message);
  }
});

route.delete('/manejo/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_manejo.destroy({ where: { id } });
    resposta ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_manejo');
    console.log(error.message);
  }
});

module.exports = route;