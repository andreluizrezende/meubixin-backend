const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_antecedentes_morbidos } = models;

route.get('/antecedentes_morbidos', async (req, res) => {
  try {
    const resposta = await mob_antecedentes_morbidos.findAll();
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_antecedentes_morbidos');
    console.log(error.message);
  }
});

route.get('/antecedentes_morbidos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_antecedentes_morbidos.findOne({ where: { id } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_antecedentes_morbidos');
    console.log(error.message);
  }
});

route.post('/antecedentes_morbidos', async (req, res) => {
  try {
    const { ds_diagnosticos, ds_resultados_exames_complementares, ds_tratamentos } = req.body;
    const resposta = await mob_antecedentes_morbidos.create({ ds_diagnosticos, ds_resultados_exames_complementares, ds_tratamentos });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_antecedentes_morbidos');
    console.log(error.message);
  }
});

route.put('/antecedentes_morbidos', async (req, res) => {
  try {
    const { id, ds_diagnosticos, ds_resultados_exames_complementares, ds_tratamentos } = req.body;
    const resposta = await mob_antecedentes_morbidos.update({ ds_diagnosticos, ds_resultados_exames_complementares, ds_tratamentos }, { where: { id } });
    resposta[0] ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_antecedentes_morbidos');
    console.log(error.message);
  }
});

route.delete('/antecedentes_morbidos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_antecedentes_morbidos.destroy({ where: { id } });
    resposta ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_antecedentes_morbidos');
    console.log(error.message);
  }
});

module.exports = route;