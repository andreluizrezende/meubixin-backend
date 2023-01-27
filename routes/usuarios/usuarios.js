const express = require('express');
const route = express.Router();
const models = require('../../models');
const usuarios = models.mob_usuarios;
const administradores = models.mob_administradores;
const {sendEmail} = require('../../utils/sendNewPass')

route.post('/usuarioRegister', async (req, res) => {
  try {
    const { no_completo, ds_senha,ds_email,nu_telefone_completo,nu_cpf} = req.body;
    const resposta = await usuarios.create({no_completo, ds_senha,ds_email,nu_telefone_completo,nu_cpf});
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('Erro em /usuarioRegister!');
    console.log(error.message);
  }
});

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

route.post('/recuperarSenha', async (req, res) => {
  try {
    const { nu_cpf, ds_email } = req.body;
    const resposta = await usuarios.findOne({ where: { nu_cpf, ds_email } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('Erro em /recuperarSenha!');
    console.log(error.message);
  }
});

route.put('/updateSenha', async (req, res) => {
  try {
    const { nu_cpf, ds_email, ds_senha } = req.body;
    const resposta = await usuarios.update({ds_senha}, { where: { nu_cpf, ds_email } });
    console.log(resposta)
    if(resposta[0]){
      res.send(true)
      sendEmail(ds_email, ds_senha)
    }else{
      res.send(false);
    } 
  } catch (error) {
    console.log('ERRO em /updateSenha');
    console.log(error.message);
  }
});

module.exports = route;