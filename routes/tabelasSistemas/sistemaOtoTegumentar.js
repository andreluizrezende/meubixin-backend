const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_sistema_oto_tegumentar } = models;

route.get('/sistema_oto_tegumentar', async (req, res) => {
  try {
    const resposta = await mob_sistema_oto_tegumentar.findAll();
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_oto_tegumentar');
    console.log(error.message);
  }
});

route.get('/sistema_oto_tegumentar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_sistema_oto_tegumentar.findOne({ where: { id } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_oto_tegumentar');
    console.log(error.message);
  }
});

route.get('/sistema_otoTegumentarAnamneseID/:Anamnese_id', async (req, res) => {
  try {
    const { Anamnese_id } = req.params;
    const resposta = await mob_sistema_oto_tegumentar.findOne({
      where: { mob_anamneses_id: Anamnese_id }
    });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /sistema_OtoTegumentarAnamneseID');
    console.log(error.message);
  }
});

route.post('/sistema_oto_tegumentar', async (req, res) => {
  try {
    const { mob_anamneses_id, ds_pele, ds_orelha, ds_unha } = req.body;
    const resposta = await mob_sistema_oto_tegumentar.create({ mob_anamneses_id, ds_pele, ds_orelha, ds_unha });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_oto_tegumentar');
    console.log(error.message);
  }
});

route.put('/sistema_oto_tegumentar', async (req, res) => {
  try {
    const { id, mob_anamneses_id, ds_pele, ds_orelha, ds_unha } = req.body;
    const resposta = await mob_sistema_oto_tegumentar.update({ mob_anamneses_id, ds_pele, ds_orelha, ds_unha }, { where: { id } });
    resposta[0] ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_oto_tegumentar');
    console.log(error.message);
  }
});

route.delete('/sistema_oto_tegumentar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_sistema_oto_tegumentar.destroy({ where: { id } });
    resposta ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_oto_tegumentar');
    console.log(error.message);
  }
});

module.exports = route;