'use strict';

/*
 * Envia uma imagem vinda do S3 com o Content-Type CORRETO.
 *
 * As rotas de imagem (foto do pet, logo/assinatura do vet, imagem de anamnese)
 * fixavam o header — duas em `image/jpeg`, uma em `image/png` — com um comentário
 * "ou image/png, dependendo do formato" que nunca foi resolvido. Resultado: um PNG
 * era anunciado como JPEG e vice-versa. Os navegadores atuais perdoam (fazem
 * sniffing), mas o header errado quebra quem confia nele: download com extensão
 * trocada, `<canvas>`/conversão, e clientes mais estritos.
 *
 * As chaves no S3 NÃO têm extensão (`veterinarios/14000_BA_logo`,
 * `profilePet/621_Runa`), então não há como deduzir pelo nome — só pelos bytes.
 * Por isso o corpo é sempre bufferizado antes de responder, em vez de `pipe`:
 * são imagens pequenas (logo, assinatura, foto de perfil) e o `pipe` impediria
 * olhar os primeiros bytes. O ramo de buffer já existia como fallback nas rotas.
 */

// Assinaturas (magic numbers) dos formatos que o sistema realmente recebe.
function detectarMimeImagem(buffer) {
  if (!buffer || buffer.length < 12) return 'application/octet-stream';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  // GIF: "GIF8"
  if (buffer.toString('ascii', 0, 4) === 'GIF8') {
    return 'image/gif';
  }
  // WebP: "RIFF" .... "WEBP"
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return 'application/octet-stream';
}

/**
 * Bufferiza o stream do S3, detecta o tipo e responde.
 * @param {object} res        resposta do Express
 * @param {*}      fileStream `Body` do GetObject (stream) ou Buffer
 * @param {string} cacheControl valor do header Cache-Control
 */
async function enviarImagem(res, fileStream, cacheControl = 'public, max-age=3600') {
  let buffer;
  if (Buffer.isBuffer(fileStream)) {
    buffer = fileStream;
  } else {
    const chunks = [];
    for await (const chunk of fileStream) chunks.push(chunk);
    buffer = Buffer.concat(chunks);
  }

  res.set({
    'Content-Type': detectarMimeImagem(buffer),
    'Content-Length': String(buffer.length),
    'Cache-Control': cacheControl,
  });
  return res.send(buffer);
}

module.exports = { detectarMimeImagem, enviarImagem };
