const express = require('express');
const route = express.Router();
const models = require('../../models');
const usuarios = models.mob_usuarios;
const administradores = models.mob_administradores;

route.post('/usuarioLogin', async (req, res) => {
  try {
    const { nu_cpf, ds_senha } = req.body;
    const resposta = await usuarios.findOne({ where: { nu_cpf, ds_senha } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('Erro em /usuarioLogin!');
    console.log(error.message);
  }
});

route.post('/checkUsuarioCPF', async (req, res) => {
  console.log("ta no backend")
  try {
    const {nu_cpf} = req.body;
    const resposta = await usuarios.findOne({ where: { nu_cpf} });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('/checkUsuarioCPF');
    console.log(error.message);
  }
});

route.post('/administradorLogin', async (req, res) => {
  try {
    const { mob_usuarios_id } = req.body;
    const resposta = await administradores.findOne({ where: { mob_usuarios_id } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('Erro em /usuarioLogin!');
    console.log(error.message);
  }
});

module.exports = route;