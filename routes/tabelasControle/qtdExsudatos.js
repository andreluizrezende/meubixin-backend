const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_qtd_exsudatos } = models;

route.get('/mob_qtd_exsudatos', async (req, res) => {
  try {
    const resposta = await mob_qtd_exsudatos.findAll();
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_qtd_exsudatos');
    console.log(error.message);
  }
});

route.get('/mob_qtd_exsudatos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_qtd_exsudatos.findOne({ where: { id } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_qtd_exsudatos');
    console.log(error.message);
  }
});

route.post('/mob_qtd_exsudatos', async (req, res) => {
  try {
    const { ds_qtd_exsudatos } = req.body;
    const resposta = await mob_qtd_exsudatos.create({ ds_qtd_exsudatos });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_qtd_exsudatos');
    console.log(error.message);
  }
});

route.put('/mob_qtd_exsudatos', async (req, res) => {
  try {
    const { id, ds_qtd_exsudatos } = req.body;
    const resposta = await mob_qtd_exsudatos.update({ ds_qtd_exsudatos }, { where: { id } });
    resposta[0] ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_qtd_exsudatos');
    console.log(error.message);
  }
});

route.delete('/mob_qtd_exsudatos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_qtd_exsudatos.destroy({ where: { id } });
    resposta ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_qtd_exsudatos');
    console.log(error.message);
  }
});

module.exports = route;