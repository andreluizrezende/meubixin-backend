require('dotenv').config();
const { 
  S3Client, 
  PutObjectCommand, 
  ListBucketsCommand, 
  CreateBucketCommand, 
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsCommand,
  DeleteObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const Bucket = process.env.AWS_BUCKET_NAME_VALUE;
const region = process.env.AWS_BUCKET_REGION_VALUE;
const accessKeyId = process.env.AWS_ACCESS_KEY_VALUE;
const secretAccessKey = process.env.AWS_SECRET_KEY_VALUE;

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

// Upload para S3 com configurações específicas para prescrições
async function uploadToS3(buffer, fileName, contentType = 'application/pdf') {
  const uploadParams = {
    Bucket,
    Key: fileName,
    Body: buffer,
    ContentType: contentType,
    ServerSideEncryption: 'AES256' // Criptografia no servidor
  };

  try {
    console.log(`Iniciando upload para S3: ${fileName}`);
    const result = await s3.send(new PutObjectCommand(uploadParams));
    
    // Construir URL do arquivo
    const fileUrl = `https://${Bucket}.s3.${region}.amazonaws.com/${fileName}`;
    
    console.log(`Upload concluído: ${fileName}`);
    return {
      success: true,
      location: fileUrl,
      key: fileName,
      etag: result.ETag
    };
  } catch (error) {
    console.error('Erro no upload S3:', error);
    throw new Error(`Falha no upload: ${error.message}`);
  }
}

// Download de arquivo do S3
async function downloadFromS3(fileName) {
  const downloadParams = {
    Bucket,
    Key: fileName
  };

  try {
    console.log(`Baixando arquivo do S3: ${fileName}`);
    const result = await s3.send(new GetObjectCommand(downloadParams));
    
    // Converter stream para buffer se necessário
    if (result.Body) {
      return result.Body;
    } else {
      throw new Error('Arquivo vazio ou não encontrado');
    }
  } catch (error) {
    console.error('Erro no download S3:', error);
    if (error.name === 'NoSuchKey') {
      throw new Error('Arquivo não encontrado no S3');
    }
    throw error;
  }
}

// Gerar URL assinada para download temporário
async function getSignedUrlForDownload(fileName, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket,
    Key: fileName
  });

  try {
    console.log(`Gerando URL assinada para: ${fileName}`);
    const signedUrl = await getSignedUrl(s3, command, { expiresIn });
    
    return {
      success: true,
      url: signedUrl,
      expiresIn: expiresIn
    };
  } catch (error) {
    console.error('Erro ao gerar URL assinada:', error);
    throw new Error(`Falha ao gerar URL: ${error.message}`);
  }
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

// Existência de um objeto no S3.
//
// ⚠️ Com as credenciais atuais, chave INEXISTENTE **não** devolve `NoSuchKey`:
// o usuário IAM não tem `s3:ListBucket` e, nesse caso, o S3 responde
// `AccessDenied` (403) de propósito, para não revelar se o objeto existe.
// Tratar só `NoSuchKey` como "não existe" fazia toda imagem ausente virar
// exceção, e as rotas que chamam esta função devolviam **500** no lugar do 404
// que o código logo abaixo delas pretendia retornar (pet sem foto = 500).
//
// HeadObject no lugar de GetObject: mesma permissão exigida, sem baixar o corpo
// do arquivo — quem chama faz o `getFileStream` depois, só se existir.
async function fileExists(Key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket, Key }));
    return true;
  } catch (err) {
    const status = err.$metadata && err.$metadata.httpStatusCode;

    if (err.name === 'NotFound' || err.name === 'NoSuchKey' || status === 404) {
      return false;
    }

    // 403 é ambíguo: pode ser objeto ausente (mascarado pela falta de
    // `s3:ListBucket`) OU credencial sem acesso de verdade. Respondemos
    // "não existe" para a rota devolver 404, mas registramos uma linha — com a
    // Key — para um problema real de IAM não passar despercebido.
    if (err.name === 'AccessDenied' || status === 403) {
      console.log(`[s3] AccessDenied em HeadObject "${Key}" — tratado como inexistente (sem s3:ListBucket, o S3 mascara o 404).`);
      return false;
    }

    console.log(`[s3] Erro ao verificar existência de "${Key}":`, err.name || err.message);
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
  fileExists,
  // Novas funções para prescrições
  uploadToS3,
  downloadFromS3,
  getSignedUrlForDownload,
  s3,
  Bucket
}