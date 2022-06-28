const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_tipo_tecidos } = models;

route.get('/mob_tipo_tecidos', async (req, res) => {
  try {
    const resposta = await mob_tipo_tecidos.findAll();
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_tipo_tecidos');
    console.log(error.message);
  }
});

route.get('/mob_tipo_tecidos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_tipo_tecidos.findOne({ where: { id } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_tipo_tecidos');
    console.log(error.message);
  }
});

route.post('/mob_tipo_tecidos', async (req, res) => {
  try {
    const { ds_tipo_tecidos } = req.body;
    const resposta = await mob_tipo_tecidos.create({ ds_tipo_tecidos });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_tipo_tecidos');
    console.log(error.message);
  }
});

route.put('/mob_tipo_tecidos', async (req, res) => {
  try {
    const { id, ds_tipo_tecidos } = req.body;
    const resposta = await mob_tipo_tecidos.update({ ds_tipo_tecidos }, { where: { id } });
    resposta[0] ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_tipo_tecidos');
    console.log(error.message);
  }
});

route.delete('/mob_tipo_tecidos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_tipo_tecidos.destroy({ where: { id } });
    resposta ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_tipo_tecidos');
    console.log(error.message);
  }
});

module.exports = route;
