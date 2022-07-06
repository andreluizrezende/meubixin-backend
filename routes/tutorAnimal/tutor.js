const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_tutores } = models;
const Op = require('sequelize').Op;

route.get('/tutores', async (req, res) => {
  try {
    const resposta = await mob_tutores.findAll();
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /tutores');
    console.log(error.message);
  }
});

route.get('/tutores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_tutores.findOne({ where: { id } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /tutores');
    console.log(error.message);
  }
});


route.get('/tutoresCpf/:nu_cpf', async (req, res) => {
  try {
    const { nu_cpf } = req.params;
    const resposta = await mob_tutores.findOne({ where: { nu_cpf } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /tutores');
    console.log(error.message);
  }
});

route.post('/tutores', async (req, res) => {
  try {
    const { no_completo, nu_cpf, ds_email, nu_telefone_completo } = req.body;
    const resposta = await mob_tutores.create({ no_completo, nu_cpf, ds_email, nu_telefone_completo });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_tutores');
    console.log(error.message);
  }
});

route.put('/tutores', async (req, res) => {
  try {
    const { id, no_completo, nu_cpf, ds_email, nu_telefone_completo } = req.body;
    const resposta = await mob_tutores.update({ no_completo, nu_cpf, ds_email, nu_telefone_completo }, { where: { id } });
    resposta[0] ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_tutores');
    console.log(error.message);
  }
});

route.delete('/tutores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_tutores.destroy({ where: { id } });
    resposta ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /tutores');
    console.log(error.message);
  }
});

module.exports = route;
