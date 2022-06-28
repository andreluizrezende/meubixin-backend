const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_local_feridas } = models;

route.get('/mob_local_feridas', async (req, res) => {
  try {
    const resposta = await mob_local_feridas.findAll();
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_local_feridas');
    console.log(error.message);
  }
});

route.get('/mob_local_feridas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_local_feridas.findOne({ where: { id } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_local_feridas');
    console.log(error.message);
  }
});

route.post('/mob_local_feridas', async (req, res) => {
  try {
    const { ds_local_feridas } = req.body;
    const resposta = await mob_local_feridas.create({ ds_local_feridas });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_local_feridas');
    console.log(error.message);
  }
});

route.put('/mob_local_feridas', async (req, res) => {
  try {
    const { id, ds_local_feridas } = req.body;
    const resposta = await mob_local_feridas.update({ ds_local_feridas }, { where: { id } });
    resposta[0] ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_local_feridas');
    console.log(error.message);
  }
});

route.delete('/mob_local_feridas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_local_feridas.destroy({ where: { id } });
    resposta ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_local_feridas');
    console.log(error.message);
  }
});

module.exports = route;