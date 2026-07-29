require('dotenv').config();
// ┌───────────────────────────────────────────────────────────────────────────┐
// │ CÓDIGO MORTO — REMOVER A PARTIR DE 15/08/2026                             │
// ├───────────────────────────────────────────────────────────────────────────┤
// │ O módulo S3 vivo do sistema é `utils/s3_teste.js` — é dele que TODAS as   │
// │ rotas reais importam (veterinários, atestados, prescrições, cobranças,    │
// │ anamneses, animais, feridas, portal, app).                                │
// │                                                                           │
// │ Deste arquivo sobrou UM consumidor: `deleteFile`, usado no DELETE /upload │
// │ de `routes/uploadImagens/upload.js`. Todo o resto (`uploadFile`,          │
// │ `getFileStream`, `listFileStream`, `listBuckets`, `createBucket`) está    │
// │ comentado abaixo — as rotas que os usavam estavam quebradas e também      │
// │ foram comentadas, com a mesma data.                                       │
// │                                                                           │
// │ Ao remover: migrar `deleteFile` para `s3_teste.js` (que já tem a sua)     │
// │ e apagar este arquivo por inteiro.                                        │
// └───────────────────────────────────────────────────────────────────────────┘
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const Bucket = process.env.AWS_BUCKET_NAME_VALUE;
const region = process.env.AWS_BUCKET_REGION_VALUE;
const accessKeyId = process.env.AWS_ACCESS_KEY_VALUE;
const secretAccessKey = process.env.AWS_SECRET_KEY_VALUE;

const s3 = new S3Client({
  region,
  credentials: { accessKeyId, secretAccessKey }
});

// CÓDIGO MORTO — remover a partir de 15/08/2026 (ver bloco no topo).
// Nenhuma rota importa estas três daqui: `upload.js` pega `uploadFile` e
// `getFileStream` de `s3_teste.js`, e `listFileStream` nunca chegou a ser
// importado (a vírgula que faltava no destructuring).
// // uploads a file to s3
// async function uploadFile(Body, Key) {
//   console.log("Body", Body)
//   const uploadParams = { Bucket, Body, Key }
//   try {
//     const data = await s3.send(new PutObjectCommand(uploadParams));
//
//     return data;
//   } catch (err) {
//     console.log("Error", err);
//   }
// }
//
// // downloads a file from s3
// async function getFileStream(Key) {
//   const downloadParams = { Key, Bucket }
//
//   try {
//     const data = await s3.send(new GetObjectCommand(downloadParams));
//     return data.Body;
//   } catch (err) {
//     console.log("Error", err);
//   }
// }
//
// async function listFileStream() {
//   try {
//     const bucketParams = { Bucket }
//     const data = await s3.send(new ListObjectsCommand(bucketParams));
//     return data;
//   } catch (err) {
//     console.log("Error", err);
//   }
// }

// ⚠️ VIVA — NÃO remover junto com o resto deste arquivo.
// Usada pelo `DELETE /upload/:key`, que o APP (`m-cicatribiovet`,
// `utils/enquadramento/requests/uploadDelete.js`) chama ao excluir imagem de
// ferida. Ao limpar o arquivo em 15/08/2026, migrar esta função para
// `s3_teste.js` e reapontar o import de `upload.js` — não apagar direto.
// delete file from s3
async function deleteFile(Key) {
  let params = {
    Bucket,
    Key
  }
  try {
    const data = await s3.send(new DeleteObjectCommand(params));

    return data;
  } catch (err) {
    console.log("Error", err);
  }
}

// CÓDIGO MORTO — remover a partir de 15/08/2026 (ver bloco no topo).
// Rotas administrativas de bucket (`/uploadListeningBucket`,
// `/uploadCreateBucket`), sem consumidor no web nem no app, e que falhariam de
// qualquer forma: o usuário IAM atual não tem `s3:ListBucket`.
// const listBuckets = async () => {
//   try {
//     const data = await s3.send(new ListBucketsCommand({}));
//     if (data) return data.Buckets; else return false;
//   } catch (err) {
//     console.log("Error", err);
//   }
// };
//
// const createBucket = async name => {
//   const bucketParams = { Bucket: name }
//   try {
//     const data = await s3.send(new CreateBucketCommand(bucketParams));
//     return data;
//   } catch (err) {
//     console.log("Error", err);
//   }
// }

module.exports = {
  deleteFile,
  // CÓDIGO MORTO — remover a partir de 15/08/2026 (ver bloco no topo).
  // getFileStream,
  // uploadFile,
  // listBuckets,
  // createBucket,
  // listFileStream
}