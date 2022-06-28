const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_manejo } = models;

route.get('/manejo', async (req, res) => {
  try {
    const resposta = await mob_manejo.findAll();
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_manejo');
    console.log(error.message);
  }
});

route.get('/manejo/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_manejo.findOne({ where: { id } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_manejo');
    console.log(error.message);
  }
});

route.post('/manejo', async (req, res) => {
  try {
    const { mob_animais_id, mob_antecedentes_morbidos_id, ds_presenca_ectoparazitas, ds_ambiente, ds_dieta, ds_banhos, ds_vacinacao, ds_contactantes } = req.body;
    const resposta = await mob_manejo.create({ mob_animais_id, mob_antecedentes_morbidos_id, ds_presenca_ectoparazitas, ds_ambiente, ds_dieta, ds_banhos, ds_vacinacao, ds_contactantes });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_manejo');
    console.log(error.message);
  }
});

route.put('/manejo', async (req, res) => {
  try {
    const { id, mob_animais_id, mob_antecedentes_morbidos_id, ds_presenca_ectoparazitas, ds_ambiente, ds_dieta, ds_banhos, ds_vacinacao, ds_contactantes } = req.body;
    const resposta = await mob_manejo.update({ mob_animais_id, mob_antecedentes_morbidos_id, ds_presenca_ectoparazitas, ds_ambiente, ds_dieta, ds_banhos, ds_vacinacao, ds_contactantes }, { where: { id } });
    resposta[0] ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_manejo');
    console.log(error.message);
  }
});

route.delete('/manejo/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_manejo.destroy({ where: { id } });
    resposta ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_manejo');
    console.log(error.message);
  }
});

module.exports = route;