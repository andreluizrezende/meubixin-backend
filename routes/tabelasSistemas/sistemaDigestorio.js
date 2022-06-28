const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_sistema_digestorio } = models;

route.get('/sistema_digestorio', async (req, res) => {
  try {
    const resposta = await mob_sistema_digestorio.findAll();
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_digestorio');
    console.log(error.message);
  }
});

route.get('/sistema_digestorio/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_sistema_digestorio.findOne({ where: { id } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_digestorio');
    console.log(error.message);
  }
});

route.post('/sistema_digestorio', async (req, res) => {
  try {
    const { mob_anamneses_id, ds_apetite, ds_regurgitacao, ds_fezes, ds_ingestao_agua } = req.body;
    const resposta = await mob_sistema_digestorio.create({ mob_anamneses_id, ds_apetite, ds_regurgitacao, ds_fezes, ds_ingestao_agua });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_digestorio');
    console.log(error.message);
  }
});

route.put('/sistema_digestorio', async (req, res) => {
  try {
    const { id, mob_anamneses_id, ds_apetite, ds_regurgitacao, ds_fezes, ds_ingestao_agua } = req.body;
    const resposta = await mob_sistema_digestorio.update({ mob_anamneses_id, ds_apetite, ds_regurgitacao, ds_fezes, ds_ingestao_agua }, { where: { id } });
    resposta[0] ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_digestorio');
    console.log(error.message);
  }
});

route.delete('/sistema_digestorio/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_sistema_digestorio.destroy({ where: { id } });
    resposta ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_digestorio');
    console.log(error.message);
  }
});

module.exports = route;