const express = require('express');
const route = express.Router();
const upload = require('../../utils/multer');
const fs = require('fs');
const { getFileStream, listBuckets, createBucket, uploadFile, listFileStream, deleteFile } = require('../../utils/s3');
const path = require('path');
const models = require('../../models');
const { mob_imagens_feridas } = models;

route.get('/upload/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const keyS3 = key.split('.')[0];
    const readStream = await getFileStream(keyS3);
    if (!readStream) return res.send(false);
    readStream.pipe(res);
  } catch (error) {
    console.log('ERRO em /upload');
    console.log(error.message);
  }
});

route.get('/upload', (req, res) => {
  return res.send(listFileStream());
});

route.post('/upload', upload.single("img"), async (req, res) => {
  try {
    const id = Number(req.body.id);
    const fileStream = fs.createReadStream(req.file.path);
    const file = req.file.filename;

    const ds_caminho_server = `http://localhost:3000/upload/${file}`;
    const resposta = await mob_imagens_feridas.update({ ds_caminho_server }, { where: { id } });

    uploadFile(fileStream, file);

    resposta[0] ? res.send(ds_caminho_server) : res.send(false);
  } catch (error) {
    console.log('ERRO em /upload');
    console.log(error.message);
  }
});

route.put('/upload', upload.single("img"), async (req, res) => {
  try {
    const { key } = req.body;
    const keyS3 = key.split('.')[0];
    const id = Number(req.body.id);
    const fileStream = fs.createReadStream(req.file.path);
    const file = req.file.filename;


    const ds_caminho_server = `http://localhost:3000/upload/${file}`;
    uploadFile(fileStream, keyS3);
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
    const keyS3 = key.split('.')[0];
    const pathFile = path.resolve(__dirname, "..", "..", "uploads", `${key}`);
    deleteFile(keyS3);
    fs.rm(path.resolve(pathFile), (err, data) => {
      if (err) return res.send(err);
      res.send(true);
    });
  } catch (error) {
    console.log('ERRO em /upload');
    console.log(error.message);
  }
});

route.get('/uploadListeningBucket', async (req, res) => {
  return res.send(listBuckets());
});

route.post('/uploadCreateBucket', async (req, res) => {
  const { name } = req.body;
  return res.send(createBucket(name));
});

module.exports = route;