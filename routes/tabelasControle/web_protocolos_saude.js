const express = require('express');
const route = express.Router();
const models = require('../../models');
const { WebProtocolosSaude } = models;

route.get('/web_protocolos_saude', async (req, res) => {
  try {
    const resposta = await WebProtocolosSaude.findAll();
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /web_protocolos_saude');
    console.log(error.message);
    res.status(500).send({ error: 'Erro ao buscar protocolos de saúde' });
  }
});

module.exports = route;
