const express = require("express");
const route = express.Router();
const upload = require("../../utils/multer");
const {
  listBuckets,
  createBucketlistFileStream,
  deleteFile,
} = require("../../utils/s3");
const { uploadFile, getFileStream } = require("../../utils/s3_teste");
const fs = require("fs");
const path = require("path");
const models = require("../../models");
const { mob_imagens_feridas, mob_protocolos_agendas } = models;

// Adicione esta rota ao seu arquivo
route.get('/animalImagem/:key', async (req, res) => {
  try {
    const { key } = req.params;
    
    // Verificar se a key foi fornecida
    if (!key) {
      return res.status(400).send({ error: 'Key da imagem é obrigatória' });
    }
    
    // Chamar o serviço para obter o stream da imagem do S3
    const streamRead = await getFileStream(`profilePet/${key}`);
    
    // Se não encontrar a imagem
    if (!streamRead) {
      return res.status(404).send({ error: 'Imagem não encontrada' });
    }
    
    // Converter o stream para base64
    const streamToB64 = (stream) =>
      new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => {
          chunks.push(chunk);
        });
        stream.on("error", reject);
        stream.on("end", () =>
          resolve(Buffer.concat(chunks).toString("base64"))
        );
      });
    
    // Define o tipo MIME
    const mimeType = "image/png";
    const b64 = await streamToB64(streamRead);
    
    // Formato para renderização
    const formatRender = `data:${mimeType};base64,${b64}`;
    res.send(JSON.stringify(formatRender));
    
  } catch (error) {
    console.log('ERRO em /animalImagem');
    console.log(error.message);
    res.status(500).send({ error: error.message });
  }
});

route.get("/upload/:key", async (req, res) => {
  try {
    const { key } = req.params;
    const keyS3 = key.split(".")[0];
    const streamRead = await getFileStream(keyS3);
    console.log(streamRead, ":: streamRead")
    if (!streamRead) return res.send(false);

    const streamToB64 = (stream) =>
      new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => {
          chunks.push(chunk);
        });
        stream.on("error", reject);
        stream.on("end", () =>
          resolve(Buffer.concat(chunks).toString("base64"))
        );
      });

    const mimeType = "image/png";
    const b64 = await streamToB64(streamRead);

    const formatRender = `data:${mimeType};base64,${b64}`;
    res.send(JSON.stringify(formatRender));
  } catch (error) {
    console.log("ERRO em /upload");
    console.log(error.message);
  }
});

route.get("/upload", (req, res) => {
  return res.send(listFileStream());
});

route.post("/upload", upload.single("img"), async (req, res) => {
  console.log(" /upload .post");
  try {
    if (!req.file) return res.send(false);
    const fileStream = fs.createReadStream(req.file.path);
    const file = req.file.filename;
    await uploadFile(fileStream, file);

    const id = Number(req.body.id);
    const ds_caminho_server = `${file}`;
    const resposta = await mob_imagens_feridas.update(
      { ds_caminho_server },
      { where: { id } }
    );

    resposta[0] ? res.send(ds_caminho_server) : res.send(false);
  } catch (error) {
    console.log("ERRO em /upload");
    console.log(error.message);
  }
});

route.post("/uploadB64", async (req, res) => {
  console.log(" /uploadB64 .post ");
  try {
    const { b64 } = req.body;
    const id = Number(req.body.id);

    fs.writeFileSync(
      path.resolve(__dirname, "temp.png"),
      b64,
      "base64",
      function (err) {
        console.log("ERRO UPLOAD B64:", err);
      }
    );
    const fileStream = fs.createReadStream(path.resolve(__dirname, "temp.png"));
    const file = Date.now() + "-" + Math.round(Math.random() * 1e9) + "-foto";

    await uploadFile(fileStream, file);

    const ds_caminho_server = `${file}`;
    const resposta = await mob_imagens_feridas.update(
      { ds_caminho_server },
      { where: { id } }
    );
    resposta[0] ? res.send(ds_caminho_server) : res.send(false);
  } catch (error) {
    console.log("ERRO em /upload");
    console.log(error.message);
  }
});

route.post("/uploadB64Protocolos", async (req, res) => {
  console.log(" /uploadB64Protocolos .post ", req.body);
  try {
    const { b64 } = req.body;
    const id = Number(req.body.id);

    fs.writeFileSync(
      path.resolve(__dirname, "temp.png"),
      b64,
      "base64",
      function (err) {
        console.log("ERRO UPLOAD B64:", err);
      }
    );
    const fileStream = fs.createReadStream(path.resolve(__dirname, "temp.png"));
    const file = Date.now() + "-" + Math.round(Math.random() * 1e9) + "-foto";

    await uploadFile(fileStream, file);

    const ds_caminho_server = `${file}`;

    const resposta = await mob_protocolos_agendas.update(
      { ds_caminho_server },
      { where: { id } }
    );
    resposta[0] ? res.send(ds_caminho_server) : res.send(false);


  } catch (error) {
    console.log("ERRO em /upload");
    console.log(error.message);
  }
});

route.put("/upload", upload.single("img"), async (req, res) => {
  console.log(" /upload .put");
  try {
    const { key } = req.body;
    const keyS3 = key.split(".")[0];
    const id = Number(req.body.id);
    const fileStream = fs.createReadStream(req.file.path);
    const file = req.file.filename;

    const ds_caminho_server = `http://localhost:3000/upload/${file}`;
    uploadFile(fileStream, keyS3);
    const resposta = await mob_imagens_feridas.update(
      { ds_caminho_server },
      { where: { id } }
    );

    resposta[0] ? res.send(ds_caminho_server) : res.send(false);
  } catch (error) {
    console.log("ERRO em /upload");
    console.log(error.message);
  }
});

route.post("/uploadProfilePet", async (req, res) => {
  console.log(" /uploadProfilePet .post ");
  try {
    const { b64, key } = req.body;
    
    if (!b64 || !key) {
      return res.status(400).send({ error: "Base64 e key são obrigatórios" });
    }

    fs.writeFileSync(
      path.resolve(__dirname, "temp.png"),
      b64,
      "base64",
      function (err) {
        console.log("ERRO UPLOAD B64:", err);
      }
    );
    
    const fileStream = fs.createReadStream(path.resolve(__dirname, "temp.png"));
    const file = `profilePet/${key}`;

    await uploadFile(fileStream, file);
    
    res.send({ success: true, path: file });
    
  } catch (error) {
    console.log("ERRO em /uploadProfilePet");
    console.log(error.message);
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
    console.log("ERRO em /upload");
    console.log(error.message);
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
