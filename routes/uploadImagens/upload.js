const express = require('express');
const route = express.Router();
const upload = require('../../utils/multer');
const { getFileStream, listBuckets, createBucket, uploadFile, listFileStream, deleteFile } = require('../../utils/s3');
const fs = require('fs');
const path = require('path');
const models = require('../../models');
const { mob_imagens_feridas } = models;

route.get('/upload/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const keyS3 = key.split('.')[0];
    const streamRead = await getFileStream(keyS3);
    if (!streamRead) return res.send(false);

    const streamToString = (stream) =>
      new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => {
          chunks.push(chunk)
        });
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks).toString('base64')));
      });
    const mimeType = 'image/png';
    const b64 = await streamToString(streamRead);
    const formatRender = `data:${mimeType};base64,${b64}`;
    res.send(JSON.stringify(formatRender));
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
    console.log(req.file);
    if (!req.file) return res.send(false);
    const fileStream = fs.createReadStream(req.file.path);
    const file = req.file.filename;
    uploadFile(fileStream, file);

    const id = Number(req.body.id);
    const ds_caminho_server = `/upload/${file}.png`;
    const resposta = await mob_imagens_feridas.update({ ds_caminho_server }, { where: { id } });


    resposta[0] ? res.send(ds_caminho_server) : res.send(false);
  } catch (error) {
    console.log('ERRO em /upload');
    console.log(error.message);
  }
});

route.post('/uploadB64', async (req, res) => {
  try {
    const { b64 } = req.body;
    const id = Number(req.body.id);

    fs.writeFile(path.resolve(__dirname, 'temp.png'), b64, 'base64', function (err) {
      console.log(err);
    });
    const fileStream = fs.createReadStream(path.resolve(__dirname, 'temp.png'))

    const file = Date.now() + '-' + Math.round(Math.random() * 1E9) + '-foto';
    uploadFile(fileStream, file);

    const ds_caminho_server = `/upload/${file}.png`;
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
    await deleteFile(keyS3);
    res.send(true);
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