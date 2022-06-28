const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_sistema_genito_urinario } = models;

route.get('/sistema_genito_urinario', async (req, res) => {
  try {
    const resposta = await mob_sistema_genito_urinario.findAll();
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_genito_urinario');
    console.log(error.message);
  }
});

route.get('/sistema_genito_urinario/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_sistema_genito_urinario.findOne({ where: { id } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_genito_urinario');
    console.log(error.message);
  }
});

route.post('/sistema_genito_urinario', async (req, res) => {
  try {
    const { mob_anamneses_id, ds_miccao, ds_femeas, ds_machos } = req.body;
    const resposta = await mob_sistema_genito_urinario.create({  mob_anamneses_id, ds_miccao, ds_femeas, ds_machos });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_genito_urinario');
    console.log(error.message);
  }
});

route.put('/sistema_genito_urinario', async (req, res) => {
  try {
    const { id,  mob_anamneses_id, ds_miccao, ds_femeas, ds_machos } = req.body;
    const resposta = await mob_sistema_genito_urinario.update({  mob_anamneses_id, ds_miccao, ds_femeas, ds_machos }, { where: { id } });
    resposta[0] ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_genito_urinario');
    console.log(error.message);
  }
});

route.delete('/sistema_genito_urinario/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_sistema_genito_urinario.destroy({ where: { id } });
    resposta ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_genito_urinario');
    console.log(error.message);
  }
});

module.exports = route;