require('dotenv').config();
const { S3Client, PutObjectCommand, ListBucketsCommand, CreateBucketCommand, GetObjectCommand, ListObjectsCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const Bucket = process.env.AWS_BUCKET_NAME;
const region = process.env.AWS_BUCKET_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY;
const secretAccessKey = process.env.AWS_SECRET_KEY;

const s3 = new S3Client({
  region,
  credentials: { accessKeyId, secretAccessKey }
});

// uploads a file to s3
async function uploadFile(Body, Key) {
  console.log("Body", Body) 
  const uploadParams = { Bucket, Body, Key }
  try {
    const data = await s3.send(new PutObjectCommand(uploadParams));
  
    return data;
  } catch (err) {
    console.log("Error", err);
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
  listFileStream
}