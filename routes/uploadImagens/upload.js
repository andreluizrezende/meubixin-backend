const express = require("express");
const route = express.Router();
const upload = require("../../utils/multer");
const {
  listBuckets,
  createBucketlistFileStream,
  deleteFile,
} = require("../../utils/s3");
const { uploadFile, getFileStream } = require("../../utils/s3_teste");
const models = require("../../models");
const { mob_imagens_feridas, mob_protocolos_agendas } = models;

const uniqueName = (originalname) =>
  Date.now() + '-' + Math.round(Math.random() * 1e9) + '-' + (originalname || 'foto');

route.get('/animalImagem/:key', async (req, res) => {
  try {
    const { key } = req.params;
    if (!key) return res.status(400).send({ error: 'Key da imagem é obrigatória' });

    const streamRead = await getFileStream(`profilePet/${key}`);
    if (!streamRead) return res.status(404).send({ error: 'Imagem não encontrada' });

    const streamToB64 = (stream) =>
      new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("base64")));
      });

    const b64 = await streamToB64(streamRead);
    res.send(JSON.stringify(`data:image/png;base64,${b64}`));
  } catch (error) {
    console.error('ERRO em /animalImagem:', error.message);
    res.status(500).send({ error: error.message });
  }
});

route.get("/upload/:key", async (req, res) => {
  try {
    const { key } = req.params;
    const keyS3 = key.split(".")[0];
    const streamRead = await getFileStream(keyS3);
    if (!streamRead) return res.send(false);

    const streamToB64 = (stream) =>
      new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("base64")));
      });

    const b64 = await streamToB64(streamRead);
    res.send(JSON.stringify(`data:image/png;base64,${b64}`));
  } catch (error) {
    console.error("ERRO em /upload GET:", error.message);
  }
});

route.get("/upload", (req, res) => {
  return res.send(listFileStream());
});

route.post("/upload", upload.single("img"), async (req, res) => {
  try {
    if (!req.file) return res.send(false);
    const file = uniqueName(req.file.originalname);
    await uploadFile(req.file.buffer, file);

    const id = Number(req.body.id);
    const ds_caminho_server = file;
    const resposta = await mob_imagens_feridas.update(
      { ds_caminho_server },
      { where: { id } }
    );

    resposta[0] ? res.send(ds_caminho_server) : res.send(false);
  } catch (error) {
    console.error("ERRO em /upload POST:", error.message);
  }
});

route.post("/uploadB64", async (req, res) => {
  try {
    const { b64 } = req.body;
    const id = Number(req.body.id);
    const file = uniqueName('foto');

    await uploadFile(Buffer.from(b64, 'base64'), file);

    const ds_caminho_server = file;
    const resposta = await mob_imagens_feridas.update(
      { ds_caminho_server },
      { where: { id } }
    );
    resposta[0] ? res.send(ds_caminho_server) : res.send(false);
  } catch (error) {
    console.error("ERRO em /uploadB64:", error.message);
  }
});

route.post("/uploadB64Protocolos", async (req, res) => {
  try {
    const { b64 } = req.body;
    const id = Number(req.body.id);
    const file = uniqueName('foto');

    await uploadFile(Buffer.from(b64, 'base64'), file);

    const ds_caminho_server = file;
    const resposta = await mob_protocolos_agendas.update(
      { ds_caminho_server },
      { where: { id } }
    );
    resposta[0] ? res.send(ds_caminho_server) : res.send(false);
  } catch (error) {
    console.error("ERRO em /uploadB64Protocolos:", error.message);
  }
});

route.put("/upload", upload.single("img"), async (req, res) => {
  try {
    const { key } = req.body;
    const keyS3 = key.split(".")[0];
    const id = Number(req.body.id);

    await uploadFile(req.file.buffer, keyS3);

    const ds_caminho_server = keyS3;
    const resposta = await mob_imagens_feridas.update(
      { ds_caminho_server },
      { where: { id } }
    );

    resposta[0] ? res.send(ds_caminho_server) : res.send(false);
  } catch (error) {
    console.error("ERRO em /upload PUT:", error.message);
  }
});

route.post("/uploadProfilePet", async (req, res) => {
  try {
    const { b64, key } = req.body;
    if (!b64 || !key) return res.status(400).send({ error: "Base64 e key são obrigatórios" });

    const file = `profilePet/${key}`;
    await uploadFile(Buffer.from(b64, 'base64'), file);

    res.send({ success: true, path: file });
  } catch (error) {
    console.error("ERRO em /uploadProfilePet:", error.message);
    res.status(500).send({ error: error.message });
  }
});

route.delete("/upload/:key", async (req, res) => {
  try {
    const { key } = req.params;
    const keyS3 = key.split(".")[0];
    await deleteFile(keyS3);
    res.send(true);
  } catch (error) {
    console.error("ERRO em /upload DELETE:", error.message);
  }
});

route.get("/uploadListeningBucket", async (req, res) => {
  return res.send(listBuckets());
});

route.post("/uploadCreateBucket", async (req, res) => {
  const { name } = req.body;
  return res.send(createBucket(name));
});

module.exports = route;
