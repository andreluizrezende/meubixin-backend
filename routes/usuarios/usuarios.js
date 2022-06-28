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

route.post('/administradorLogin', async (req, res) => {
  const { mob_usuarios_id } = req.body;
  const resposta = await administradores.findOne({ where: { mob_usuarios_id } });
  resposta ? res.send(resposta) : res.send(false);
});

module.exports = route;