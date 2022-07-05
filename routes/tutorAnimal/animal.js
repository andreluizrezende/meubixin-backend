const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_animais } = models;

route.get('/animais', async (req, res) => {
  try {
    const resposta = await mob_animais.findAll();
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_animais');
    console.log(error.message);
  }
});

route.get('/animais/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_animais.findOne({ where: { id } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_animais');
    console.log(error.message);
  }
});

route.get('/animalNome/:no_nome', async (req, res) => {
  try {
    const { no_nome } = req.params;
    const resposta = await mob_animais.findAll({ where: { no_nome } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /animalNome');
    console.log(error.message);
  }
});

route.post('/animais', async (req, res) => {
  try {
    const { no_nome, ds_especie, ds_sexo, ds_pelagem, vl_idade, mob_tutores_id } = req.body;
    const resposta = await mob_animais.create({ no_nome, ds_especie, ds_sexo, ds_pelagem, vl_idade, mob_tutores_id });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_animais');
    console.log(error.message);
  }
});

route.put('/animais', async (req, res) => {
  try {
    const { id, no_nome, ds_especie, ds_sexo, ds_pelagem, vl_idade, mob_tutores_id } = req.body;
    const resposta = await mob_animais.update({ no_nome, ds_especie, ds_sexo, ds_pelagem, vl_idade, mob_tutores_id }, { where: { id } });
    resposta[0] ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_animais');
    console.log(error.message);
  }
});

route.delete('/animais/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_animais.destroy({ where: { id } });
    resposta ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_animais');
    console.log(error.message);
  }
});

module.exports = route;