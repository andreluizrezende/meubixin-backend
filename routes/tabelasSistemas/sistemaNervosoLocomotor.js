const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_sistema_nervoso_locomotor } = models;

route.get('/sistema_nervoso_locomotor', async (req, res) => {
  try {
    const resposta = await mob_sistema_nervoso_locomotor.findAll();
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_nervoso_locomotor');
    console.log(error.message);
  }
});

route.get('/sistema_nervoso_locomotor/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_sistema_nervoso_locomotor.findOne({ where: { id } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_nervoso_locomotor');
    console.log(error.message);
  }
});

route.post('/sistema_nervoso_locomotor', async (req, res) => {
  try {
    const { mob_anamneses_id, ds_convulsoes, ds_alteracao_comportamento, ds_postura, ds_possibilidade_intoxicacao } = req.body;
    const resposta = await mob_sistema_nervoso_locomotor.create({ mob_anamneses_id, ds_convulsoes, ds_alteracao_comportamento, ds_postura, ds_possibilidade_intoxicacao });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_nervoso_locomotor');
    console.log(error.message);
  }
});

route.put('/sistema_nervoso_locomotor', async (req, res) => {
  try {
    const { id, mob_anamneses_id, ds_convulsoes, ds_alteracao_comportamento, ds_postura, ds_possibilidade_intoxicacao } = req.body;
    const resposta = await mob_sistema_nervoso_locomotor.update({ mob_anamneses_id, ds_convulsoes, ds_alteracao_comportamento, ds_postura, ds_possibilidade_intoxicacao }, { where: { id } });
    resposta[0] ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_nervoso_locomotor');
    console.log(error.message);
  }
});

route.delete('/sistema_nervoso_locomotor/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_sistema_nervoso_locomotor.destroy({ where: { id } });
    resposta ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_nervoso_locomotor');
    console.log(error.message);
  }
});

module.exports = route;