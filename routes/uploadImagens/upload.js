const express = require('express');
const route = express.Router();
const upload = require('../../utils/multer');
const fs = require('fs');
const path = require('path');
const models = require('../../models');
const { mob_imagens_feridas } = models;

route.get('/upload/:key', async (req, res) => {
  try {
    const { key } = req.params;
    fs.readFile(path.resolve(__dirname, "..", "..", "uploads", `${key}`), (err, data) => {
      if (err) return res.send(err);
      res.send(data);
    });
  } catch (error) {
    console.log('ERRO em /upload');
    console.log(error.message);
  }
});

route.post('/upload', upload.single("img"), async (req, res) => {
  try {
    const id = Number(req.body.id);
    const file = req.file.filename;
    const ds_caminho_server = `http://localhost:3000/upload/${file}`;
    const resposta = await mob_imagens_feridas.update({ ds_caminho_server }, { where: { id } });
    resposta[0] ? res.send(ds_caminho_server) : res.send(false);
  } catch (error) {
    console.log('ERRO em /upload');
    console.log(error.message);
  }
});

route.put('/upload', upload.single("img"), async (req, res) => {
  try {
    const { key } = req.body;
    const id = Number(req.body.id);
    const pathFile = path.resolve(__dirname, "..", "..", "uploads", `${key}`);
    const file = req.file.filename;
    const ds_caminho_server = `http://localhost:3000/upload/${file}`;

    fs.rm(path.resolve(pathFile), (err, data) => {
      if (err) return res.send(err);
    });

    const resposta = await mob_imagens_feridas.update({ ds_caminho_server }, { where: { id } });

    resposta[0] ? res.send(ds_caminho_server) : res.send(false);
  } catch (error) {
    console.log('ERRO em /upload');
    console.log(error.message);
  }
});

route.delete('/upload/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const pathFile = path.resolve(__dirname, "..", "..", "uploads", `${key}`);
    fs.rm(path.resolve(pathFile), (err, data) => {
      if (err) return res.send(err);
      res.send(true);
    });
  } catch (error) {
    console.log('ERRO em /upload');
    console.log(error.message);
  }
});

module.exports = route;