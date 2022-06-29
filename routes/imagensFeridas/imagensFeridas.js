const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_imagens_feridas } = models;

route.get('/imagens_feridas', async (req, res) => {
  try {
    const resposta = await mob_imagens_feridas.findAll();
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_imagens_feridas');
    console.log(error.message);
  }
});

route.get('/imagens_feridas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_imagens_feridas.findOne({ where: { id } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_imagens_feridas');
    console.log(error.message);
  }
});

route.post('/imagens_feridas', async (req, res) => {
  try {
    const { mob_feridas_id, ds_camino_server, vl_largura_imagem, vl_altura_imagem, vl_largura_detector, vl_altura_detector, vl_eixo_x, vl_eixo_y } = req.body;
    const resposta = await mob_imagens_feridas.create({ mob_feridas_id, ds_camino_server, vl_largura_imagem, vl_altura_imagem, vl_largura_detector, vl_altura_detector, vl_eixo_x, vl_eixo_y });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_imagens_feridas');
    console.log(error.message);
  }
});

route.put('/imagens_feridas', async (req, res) => {
  try {
    const { id, mob_feridas_id, ds_camino_server, vl_largura_imagem, vl_altura_imagem, vl_largura_detector, vl_altura_detector, vl_eixo_x, vl_eixo_y } = req.body;
    const resposta = await mob_imagens_feridas.update({ mob_feridas_id, ds_camino_server, vl_largura_imagem, vl_altura_imagem, vl_largura_detector, vl_altura_detector, vl_eixo_x, vl_eixo_y }, { where: { id } });
    resposta[0] ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_imagens_feridas');
    console.log(error.message);
  }
});

route.delete('/imagens_feridas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_imagens_feridas.destroy({ where: { id } });
    resposta ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_imagens_feridas');
    console.log(error.message);
  }
});

module.exports = route;