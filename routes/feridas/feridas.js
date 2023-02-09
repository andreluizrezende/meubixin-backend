const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_feridas, mob_local_feridas, mob_tipo_exsudatos, mob_qtd_exsudatos, mob_tipo_sintomas, mob_tipo_tecidos } = models;

route.get('/feridas', async (req, res) => {
  try {
    const resposta = await mob_feridas.findAll();
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_manejo');
    console.log(error.message);
  }
});

route.get('/feridas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_feridas.findOne({
      include: [
        { model: mob_tipo_exsudatos },
        { model: mob_qtd_exsudatos },
        { model: mob_tipo_tecidos },
        { model: mob_local_feridas },
        { model: mob_tipo_sintomas },
      ], where: { id }
    });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_feridas');
    console.log(error.message);
  }
});

route.get('/FeridasAnamneseID/:Anamnese_id', async (req, res) => {
  try {
    const { Anamnese_id } = req.params;
    const resposta = await mob_feridas.findAll({
      where: { mob_anamneses_id: Anamnese_id },
      include: [{
        model: mob_tipo_tecidos
      }]
    });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /sistema_digestorioAnamneseID');
    console.log(error.message);
  }
});

route.post('/feridas', async (req, res) => {
  try {
    const { mob_anamneses_id, mob_tipo_exsudatos_id, mob_tipo_sintomas_id, mob_local_feridas_id, mob_tipo_tecidos_id, mob_qtd_exsudatos_id, vl_comprimento, vl_largura } = req.body;
    const resposta = await mob_feridas.create({ mob_anamneses_id, mob_tipo_exsudatos_id, mob_tipo_sintomas_id, mob_local_feridas_id, mob_tipo_tecidos_id, mob_qtd_exsudatos_id, vl_comprimento, vl_largura });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_feridas');
    console.log(error.message);
  }
});

route.put('/feridas', async (req, res) => {
  try {
    const { id, mob_anamneses_id, mob_tipo_exsudatos_id, mob_tipo_sintomas_id, mob_local_feridas_id, mob_tipo_tecidos_id, mob_qtd_exsudatos_id, vl_comprimento, vl_largura } = req.body;
    const resposta = await mob_feridas.update({ mob_anamneses_id, mob_tipo_exsudatos_id, mob_tipo_sintomas_id, mob_local_feridas_id, mob_tipo_tecidos_id, mob_qtd_exsudatos_id, vl_comprimento, vl_largura }, { where: { id } });
    resposta[0] ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_feridas');
    console.log(error.message);
  }
});

route.delete('/feridas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_feridas.destroy({ where: { id } });
    resposta ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_feridas');
    console.log(error.message);
  }
});

module.exports = route;