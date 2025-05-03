// Sugestão de implementação em um arquivo como services/uploadService.js

const fs = require("fs");
const path = require("path");
const { uploadFile } = require("../../utils/s3_teste");

/**
 * Serviço para upload de imagem de perfil de pet para o S3
 * @param {string} b64 - Imagem em formato base64
 * @param {string} key - Nome do arquivo no S3
 * @returns {Promise<string>} - Caminho do arquivo no S3
 */
const uploadProfilePetService = async (b64, key) => {
  try {
    if (!b64 || !key) {
      throw new Error("Base64 e key são obrigatórios");
    }

    // Cria um arquivo temporário com a imagem base64
    const tempFilePath = path.resolve(__dirname, "temp.png");
    fs.writeFileSync(
      tempFilePath,
      b64,
      "base64",
      function (err) {
        if (err) throw err;
      }
    );
    
    // Cria um stream de leitura do arquivo
    const fileStream = fs.createReadStream(tempFilePath);
    
    // Define o caminho no S3
    const file = `profilePet/${key}`;

    // Faz upload para o S3
    await uploadFile(fileStream, file);
    
    // Remove o arquivo temporário após o upload
    fs.unlinkSync(tempFilePath);
    
    return file;
  } catch (error) {
    console.log("ERRO em uploadProfilePetService:", error.message);
    throw error;
  }
};

module.exports = {
  uploadProfilePetService
};