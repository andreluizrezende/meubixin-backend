require('dotenv').config();
const { S3Client, PutObjectCommand, ListBucketsCommand, CreateBucketCommand, GetObjectCommand, ListObjectsCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const Bucket = AWS_BUCKET_NAME = "cicatribioskin";
const region = AWS_BUCKET_REGION = "us-east-2";
const accessKeyId = AWS_ACCESS_KEY = "REMOVED_AWS_ACCESS_KEY";
const secretAccessKey = AWS_SECRET_KEY = "REMOVED_AWS_SECRET_KEY";

const s3 = new S3Client({
  region,
  credentials: { accessKeyId, secretAccessKey }
});

// uploads a file to s3
async function uploadFile(Body, Key) {
  const uploadParams = { Bucket, Body, Key };

  return new Promise((resolve, reject) => {
    console.log("Iniciando envio assíncrono...");

    s3.send(new PutObjectCommand(uploadParams))
      .then(data => {
        console.log("Upload concluído:", data);
        resolve(data);
      })
      .catch(err => {
        console.log("Erro durante o upload:", err);
        reject(err);
      });
  });
}

// downloads a file from s3
async function getFileStream(Key) {
  const downloadParams = { Key, Bucket }

  try {
    const data = await s3.send(new GetObjectCommand(downloadParams));
    return data.Body;
  } catch (err) {
    console.log("Error", err);
  }
}

async function listFileStream() {
  try {
    const bucketParams = { Bucket }
    const data = await s3.send(new ListObjectsCommand(bucketParams));
    return data;
  } catch (err) {
    console.log("Error", err);
  }
}

async function fileExists(Key) {
  const params = {
    Bucket,
    Key
  };
  
  try {
    // Tentar obter o objeto - se não existir, vai lançar uma exceção
    await s3.send(new GetObjectCommand(params));
    return true;
  } catch (err) {
    if (err.name === 'NoSuchKey') {
      return false;
    }
    // Se for outro tipo de erro, relançar
    console.log("Erro ao verificar existência do arquivo:", err);
    throw err;
  }
}


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

const listBuckets = async () => {
  try {
    const data = await s3.send(new ListBucketsCommand({}));
    if (data) return data.Buckets; else return false;
  } catch (err) {
    console.log("Error", err);
  }
};

const createBucket = async name => {
  const bucketParams = { Bucket: name }
  try {
    const data = await s3.send(new CreateBucketCommand(bucketParams));
    return data;
  } catch (err) {
    console.log("Error", err);
  }
}

module.exports = {
  deleteFile,
  getFileStream,
  uploadFile,
  listBuckets,
  createBucket,
  listFileStream,
  fileExists
}