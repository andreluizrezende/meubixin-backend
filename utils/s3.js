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
  const uploadParams = { Bucket, Body, Key }

  try {
    const data = await s3.send(new PutObjectCommand(uploadParams));
    console.log(
      "Successfully uploaded object: " +
      uploadParams.Bucket + "/" + uploadParams.Key
    );
    return data;
  } catch (err) {
    console.log("Error", err);
  }
}

// downloads a file from s3
async function getFileStream(Key) {
  const downloadParams = { Key, Bucket }

  try {
    const streamToString = (stream) =>
      new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks)));
      });

    const data = await s3.send(new GetObjectCommand(downloadParams));

    const bodyContents = await streamToString(data.Body);
    //console.log(bodyContents);
    return bodyContents;
  } catch (err) {
    console.log("Error", err);
  }
}

async function listFileStream() {
  try {
    const bucketParams = { Bucket }
    const data = await s3.send(new ListObjectsCommand(bucketParams));
    console.log("Success", data);
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
    console.log(
      "Successfully delete object: " +
      params.Bucket + "/" + params.Key
    );
    return data;
  } catch (err) {
    console.log("Error", err);
  }
}

const listBuckets = async () => {
  try {
    const data = await s3.send(new ListBucketsCommand({}));
    console.log("Success", data.Buckets);
    if (data) return data.Buckets; else return false;
  } catch (err) {
    console.log("Error", err);
  }
};

const createBucket = async name => {
  const bucketParams = { Bucket: name }
  try {
    const data = await s3.send(new CreateBucketCommand(bucketParams));
    console.log("Success", data);
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