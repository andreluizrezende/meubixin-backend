const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_tipo_sintomas } = models;

route.get('/mob_tipo_sintomas', async (req, res) => {
  try {
    const resposta = await mob_tipo_sintomas.findAll();
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_tipo_sintomas');
    console.log(error.message);
  }
});

route.get('/mob_tipo_sintomas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_tipo_sintomas.findOne({ where: { id } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_tipo_sintomas');
    console.log(error.message);
  }
});

route.post('/mob_tipo_sintomas', async (req, res) => {
  try {
    const { ds_tipo_sintomas } = req.body;
    const resposta = await mob_tipo_sintomas.create({ ds_tipo_sintomas });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_tipo_sintomas');
    console.log(error.message);
  }
});

route.put('/mob_tipo_sintomas', async (req, res) => {
  try {
    const { id, ds_tipo_sintomas } = req.body;
    const resposta = await mob_tipo_sintomas.update({ ds_tipo_sintomas }, { where: { id } });
    resposta[0] ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_tipo_sintomas');
    console.log(error.message);
  }
});

route.delete('/mob_tipo_sintomas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_tipo_sintomas.destroy({ where: { id } });
    resposta ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_tipo_sintomas');
    console.log(error.message);
  }
});

module.exports = route;