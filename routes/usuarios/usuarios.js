const express = require('express');
const route = express.Router();
const models = require('../../models');
const usuarios = models.mob_usuarios;
const administradores = models.mob_administradores;
const {sendEmail} = require('../../utils/sendNewPass');
const mob_animais = require('../../models/mob_animais');
const Sequelize = require('sequelize');
const config = require("../../config/config.json")["production"];
let sequelize = new Sequelize(config)

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

route.put('/usuarioEdit', async (req, res) => {
  try {
    const { no_completo,ds_email,nu_telefone_completo,nu_cpf, ds_senha} = req.body;
    const resposta = await usuarios.update({no_completo,ds_email,nu_telefone_completo,nu_cpf, ds_senha}, { where: { nu_cpf} });
    if(resposta[0]){
      res.send(req.body)
    }else{
      res.send(false);
    } 
  } catch (error) {
    console.log('ERRO em /usuarioEdit');
    console.log(error.message);
  }
});

//remover em 30 dias
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

route.post('/usuarioLoginIntegrado', async (req, res) => {
  try {
    const { nu_cpf, ds_senha } = req.body;
    const resposta = await usuarios.findOne({ where: { nu_cpf, ds_senha } });
    if (resposta) {
      const resposta_adm = await administradores.findOne({
        where: { mob_usuarios_id: resposta.id },
      });
      resposta_adm ? res.send(JSON.stringify(3)) : res.send(JSON.stringify(1));
    }
    else res.send(false);
  } catch (error) {
    console.log('Erro em /usuarioLoginIntegrado!');
    console.log(error.message);
  }
});

route.post('/checkUsuarioCPF', async (req, res) => {
  try {
    const {nu_cpf} = req.body;
    const resposta = await usuarios.findOne({ where: { nu_cpf} });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('/checkUsuarioCPF');
    console.log(error.message);
  }
});

//remover em 30 dias

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

route.get('/mocks', async (req, res) => {
  try {
    // const tipoFeridas = await sequelize.query('select * from mob_tipo_feridas', { type: sequelize.QueryTypes.SELECT });
    // const tipoPelagem = await sequelize.query('select * from mob_tipo_pelagem', { type: sequelize.QueryTypes.SELECT });
    const tipoTecidos = await sequelize.query('select id, ds_tipo_tecidos as description from mob_tipo_tecidos', { type: sequelize.QueryTypes.SELECT });
    const localFerida = await sequelize.query('select id, ds_local_feridas as description from mob_local_feridas', { type: sequelize.QueryTypes.SELECT });
    // const tipoEspecies = await sequelize.query('select * from mob_tipo_especies', { type: sequelize.QueryTypes.SELECT });

    res.send({ localFerida, tipoTecidos });
  } catch (error) {
    console.error(error);
    res.status(500).send('Ocorreu um erro ao obter os dados.');
  }
});


module.exports = route;
