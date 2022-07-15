const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_genito_urinario } = models;

route.get('/sistema_genito_urinario', async (req, res) => {
  try {
    const resposta = await mob_genito_urinario.findAll();
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_genito_urinario');
    console.log(error.message);
  }
});

route.get('/sistema_genito_urinario/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_genito_urinario.findOne({ where: { id } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_genito_urinario');
    console.log(error.message);
  }
});

route.get('/sistema_genito_urinarioAnamneseID/:Anamnese_id', async (req, res) => {
  try {
    const { Anamnese_id } = req.params;
    const resposta = await mob_genito_urinario.findOne({
      where: { mob_anamneses_id: Anamnese_id } 
    });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /sistema_genito_urinarioAnamneseID');
    console.log(error.message);
  }
});

route.post('/sistema_genito_urinario', async (req, res) => {
  try {
    const { mob_anamneses_id, ds_miccao, ds_libido, ds_cruzamentos, ds_castrado, ds_agressivo, 
      ds_postura_miccao, vl_intervalo_cios, ds_pseudociese, ds_contraceptivos , ds_corrimento, 
      ds_secrecao, ds_parto_anterior, ds_aborto } = req.body;
    const resposta = await mob_genito_urinario.create({ mob_anamneses_id, ds_miccao, ds_libido, 
      ds_cruzamentos, ds_castrado, ds_agressivo, ds_postura_miccao, vl_intervalo_cios, ds_pseudociese, 
      ds_contraceptivos, ds_corrimento, ds_secrecao, ds_parto_anterior, ds_aborto });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_genito_urinario');
    console.log(error.message);
  }
});

route.put('/sistema_genito_urinario', async (req, res) => {
  try {
    const { id, mob_anamneses_id, ds_miccao, ds_libido, ds_cruzamentos, ds_castrado, ds_agressivo, ds_postura_miccao, vl_intervalo_cios, ds_pseudociese, ds_contraceptivos, ds_corrimento, ds_secrecao, ds_parto_anterior, ds_aborto } = req.body;
    const resposta = await mob_genito_urinario.update({ mob_anamneses_id, ds_miccao, ds_libido, ds_cruzamentos, ds_castrado, ds_agressivo, ds_postura_miccao, vl_intervalo_cios, ds_pseudociese, ds_contraceptivos, ds_corrimento, ds_secrecao, ds_parto_anterior, ds_aborto }, { where: { id } });
    resposta[0] ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_genito_urinario');
    console.log(error.message);
  }
});

route.delete('/sistema_genito_urinario/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_genito_urinario.destroy({ where: { id } });
    resposta ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_sistema_genito_urinario');
    console.log(error.message);
  }
});

module.exports = route;