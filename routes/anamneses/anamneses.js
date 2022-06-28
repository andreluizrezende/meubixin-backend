const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_anamneses } = models;

route.get('/anamneses', async (req, res) => {
    try {
      const resposta = await mob_anamneses.findAll();
      resposta ? res.send(resposta) : res.send(false);
    } catch (error) {
      console.log('ERRO em /mob_anamneses');
      console.log(error.message);
    }
  });
  
  route.get('/anamneses/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const resposta = await mob_anamneses.findOne({ where: { id } });
      resposta ? res.send(resposta) : res.send(false);
    } catch (error) {
      console.log('ERRO em /mob_anamneses');
      console.log(error.message);
    }
  });
  
  route.post('/anamneses', async (req, res) => {
    try {
      const { mob_usuarios_id, mob_animais_id, ds_temperamento, vl_peso, ds_talhe, ds_raca, ds_trauma, vl_cirurgia, ds_claudicacao } = req.body;
      const resposta = await mob_anamneses.create({  mob_usuarios_id, mob_animais_id, ds_temperamento, vl_peso, ds_talhe, ds_raca, ds_trauma, vl_cirurgia, ds_claudicacao });
      resposta ? res.send(resposta) : res.send(false);
    } catch (error) {
      console.log('ERRO em /mob_anamneses');
      console.log(error.message);
    }
  });
  
  route.put('/anamneses', async (req, res) => {
    try {
      const { id, mob_usuarios_id, mob_animais_id, ds_temperamento, vl_peso, ds_talhe, ds_raca, ds_trauma, vl_cirurgia, ds_claudicacao } = req.body;
      const resposta = await mob_anamneses.update({ mob_usuarios_id, mob_animais_id, ds_temperamento, vl_peso, ds_talhe, ds_raca, ds_trauma, vl_cirurgia, ds_claudicacao }, { where: { id } });
      resposta[0] ? res.send(true) : res.send(false);
    } catch (error) {
      console.log('ERRO em /mob_anamneses');
      console.log(error.message);
    }
  });
  
  route.delete('/anamneses/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const resposta = await mob_anamneses.destroy({ where: { id } });
      resposta ? res.send(true) : res.send(false);
    } catch (error) {
      console.log('ERRO em /mob_anamneses');
      console.log(error.message);
    }
  });
  
  module.exports = route;