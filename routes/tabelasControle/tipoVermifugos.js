const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_tipo_vermifugos} = models;

route.get('/mob_tipo_vermifugos', async (req, res) => {
  try {
    const resposta = await mob_tipo_vermifugos.findAll();
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_tipo_vermifugos');
    console.log(error.message);
  }
});

module.exports = route;
