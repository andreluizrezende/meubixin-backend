const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_protocolos_saude} = models;

route.get('/mob_protocolos_saude', async (req, res) => {
  console.log("bateu aqui ")
  try {
    const resposta = await mob_protocolos_saude.findAll();
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_protocolos_saude');
    console.log(error.message);
  }
});

module.exports = route;
