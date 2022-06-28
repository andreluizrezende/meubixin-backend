const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_tipo_exsudatos } = models;

route.get('/mob_tipo_exsudatos', async (req, res) => {
  try {
    const resposta = await mob_tipo_exsudatos.findAll();
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_tipo_exsudatos');
    console.log(error.message);
  }
});

route.get('/mob_tipo_exsudatos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_tipo_exsudatos.findOne({ where: { id } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_tipo_exsudatos');
    console.log(error.message);
  }
});

route.post('/mob_tipo_exsudatos', async (req, res) => {
  try {
    const { ds_tipo_exsudatos } = req.body;
    const resposta = await mob_tipo_exsudatos.create({ ds_tipo_exsudatos });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_tipo_exsudatos');
    console.log(error.message);
  }
});

route.put('/mob_tipo_exsudatos', async (req, res) => {
  try {
    const { id, ds_tipo_exsudatos } = req.body;
    const resposta = await mob_tipo_exsudatos.update({ ds_tipo_exsudatos }, { where: { id } });
    resposta[0] ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_tipo_exsudatos');
    console.log(error.message);
  }
});

route.delete('/mob_tipo_exsudatos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_tipo_exsudatos.destroy({ where: { id } });
    resposta ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_tipo_exsudatos');
    console.log(error.message);
  }
});

module.exports = route;