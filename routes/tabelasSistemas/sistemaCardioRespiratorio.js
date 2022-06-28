const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_sistema_cardio_respiratorio } = models;

route.get('/sistema_cardio_respiratorio', async (req, res) => {
  try {
    const resposta = await mob_sistema_cardio_respiratorio.findAll();
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_cardio_respiratorio');
    console.log(error.message);
  }
});

route.get('/sistema_cardio_respiratorio/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_sistema_cardio_respiratorio.findOne({ where: { id } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_cardio_respiratorio');
    console.log(error.message);
  }
});

route.post('/sistema_cardio_respiratorio', async (req, res) => {
  try {
    const { mob_anamneses_id, ds_respiracao, ds_tosse, ds_espirro, ds_secrecao_nasal, ds_secrecao_ocular, ds_intolerancia_exercicio, ds_aumento_volume } = req.body;
    const resposta = await mob_sistema_cardio_respiratorio.create({ mob_anamneses_id, ds_respiracao, ds_tosse, ds_espirro, ds_secrecao_nasal, ds_secrecao_ocular, ds_intolerancia_exercicio, ds_aumento_volume });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_cardio_respiratorio');
    console.log(error.message);
  }
});

route.put('/sistema_cardio_respiratorio', async (req, res) => {
  try {
    const { id, mob_anamneses_id, ds_respiracao, ds_tosse, ds_espirro, ds_secrecao_nasal, ds_secrecao_ocular, ds_intolerancia_exercicio, ds_aumento_volume } = req.body;
    const resposta = await mob_sistema_cardio_respiratorio.update({ mob_anamneses_id, ds_respiracao, ds_tosse, ds_espirro, ds_secrecao_nasal, ds_secrecao_ocular, ds_intolerancia_exercicio, ds_aumento_volume }, { where: { id } });
    resposta[0] ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_cardio_respiratorio');
    console.log(error.message);
  }
});

route.delete('/sistema_cardio_respiratorio/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_sistema_cardio_respiratorio.destroy({ where: { id } });
    resposta ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_cardio_respiratorio');
    console.log(error.message);
  }
});

module.exports = route;