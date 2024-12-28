const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_veterinarios } = models;

// Rota para buscar todos os veterinários
route.get('/veterinarios', async (req, res) => {
  try {
    const resposta = await mob_veterinarios.findAll();
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /veterinarios');
    console.log(error.message);
  }
});

// Rota para buscar um veterinário por ID
route.get('/veterinarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_veterinarios.findAll({ where: { mob_usuarios_id: id } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /veterinarios');
    console.log(error.message);
  }
});

route.get('/veterinarios/details/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const resposta = await mob_veterinarios.findAll({ where: { id } });
      resposta ? res.send(resposta) : res.send(false);
    } catch (error) {
      console.log('ERRO em /veterinarios');
      console.log(error.message);
    }
  });
  

// Rota para criar um novo veterinário
route.post('/veterinarios', async (req, res) => {
  try {
    const { nu_crmv, ds_estado_crmv, no_completo, ds_email, nu_telefone_completo, mob_usuarios_id } = req.body;
    const resposta = await mob_veterinarios.create({
      nu_crmv,
      ds_estado_crmv,
      no_completo,
      ds_email,
      nu_telefone_completo,
      mob_usuarios_id
    });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /veterinarios');
    console.log(error.message);
  }
});

// Rota para atualizar um veterinário existente
route.put('/veterinarios', async (req, res) => {
  try {
    const { id, nu_crmv, ds_estado_crmv, no_completo, ds_email, nu_telefone_completo } = req.body;
    const resposta = await mob_veterinarios.update(
      { nu_crmv, ds_estado_crmv, no_completo, ds_email, nu_telefone_completo },
      { where: { id } }
    );
    resposta[0] ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /veterinarios');
    console.log(error.message);
  }
});

// Rota para deletar um veterinário pelo ID
route.delete('/veterinarios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_veterinarios.destroy({ where: { id } });
    resposta ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /veterinarios');
    console.log(error.message);
  }
});

module.exports = route;
