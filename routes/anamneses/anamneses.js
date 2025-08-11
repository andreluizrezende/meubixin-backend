const express = require("express");
const route = express.Router();
const models = require("../../models");
const { mob_anamneses } = models;
const Sequelize = require("sequelize");
const env = process.env.NODE_ENV || "production";
const config = require("../../config/config.json")[env];
const { uploadFile, deleteFile, getFileStream, fileExists } = require("../../utils/s3_teste");


let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    config
  );
}

//alteração para possibilitar a transição
const { mob_sistema_oto_tegumentar } = models;

route.get("/anamneses", async (req, res) => {
  try {
    const resposta = await mob_anamneses.findAll();
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log("ERRO em /mob_anamneses");
    console.log(error.message);
  }
});

route.get("/anamneses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_anamneses.findOne({ where: { id } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log("ERRO em /mob_anamneses");
    console.log(error.message);
  }
});

// Rota para buscar anamnese completa com SQL direto
route.get("/anamneses/:id/completa", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Query SQL para buscar anamnese com dados do sistema oto-tegumentar
    const anamneseQuery = `
      SELECT 
        a.id,
        a.dt_data,
        sot.ds_pele
      FROM mob_anamneses a
      LEFT JOIN mob_sistema_oto_tegumentar sot ON a.id = sot.mob_anamneses_id
      WHERE a.id = ?
    `;
    
    // Query SQL para buscar feridas da anamnese com seus relacionamentos
    const feridasQuery = `
      SELECT 
        f.id,
        f.vl_comprimento,
        f.vl_largura,
        f.createdAt as data_envio,
        lf.ds_local_feridas as local,
        tt.ds_tipo_tecidos as tipo_tecido,
        imf.id as imagem_id,
        imf.ds_caminho_server,
        sif.vl_dimensao_ia
      FROM mob_feridas f
      LEFT JOIN mob_local_feridas lf ON f.mob_local_feridas_id = lf.id
      LEFT JOIN mob_tipo_tecidos tt ON f.mob_tipo_tecidos_id = tt.id
      LEFT JOIN mob_imagens_feridas imf ON f.id = imf.mob_feridas_id
      LEFT JOIN srv_imagens_feridas sif ON imf.id = sif.mob_imagens_feridas_id
      WHERE f.mob_anamneses_id = ?
      ORDER BY f.id, imf.id
    `;
    
    // Executar as queries
    const [anamneseResults] = await sequelize.query(anamneseQuery, {
      replacements: [id],
      type: sequelize.QueryTypes.SELECT
    });
    
    if (!anamneseResults) {
      return res.status(404).json({ error: 'Anamnese não encontrada' });
    }
    
    const [feridasResults] = await sequelize.query(feridasQuery, {
      replacements: [id]
    });
    
    // Processar os resultados das feridas para agrupar imagens por ferida
    const feridasMap = new Map();
    
    feridasResults.forEach(row => {
      const feridaId = row.id;
      
      if (!feridasMap.has(feridaId)) {
        feridasMap.set(feridaId, {
          id: feridaId,
          local: row.local || 'Não informado',
          comprimento: row.vl_comprimento,
          largura: row.vl_largura,
          data_envio: row.data_envio,
          tipo_tecido: row.tipo_tecido || 'Não informado',
          imagens: []
        });
      }
      
      // Adicionar imagem se existir
      if (row.imagem_id && row.ds_caminho_server) {
        feridasMap.get(feridaId).imagens.push({
          id: row.imagem_id,
          caminho_s3: row.ds_caminho_server,
          dimensao_ia: row.vl_dimensao_ia || null
        });
      }
    });
    
    // Converter Map para Array
    const feridasEstruturadas = Array.from(feridasMap.values());
    
    // Estruturar resposta final
    const resposta = {
      id: anamneseResults.id,
      dt_data: anamneseResults.dt_data,
      pele: anamneseResults.ds_pele || 'Não informado',
      feridas: feridasEstruturadas
    };
    
    res.json(resposta);
    
  } catch (error) {
    console.log("ERRO em /anamneses/:id/completa");
    console.log(error.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para buscar imagem específica de uma ferida
route.get('/feridas/:id/imagem/:imagemId', async (req, res) => {
  try {
    const { id, imagemId } = req.params;
    
    // Query SQL para buscar dados da imagem da ferida
    const imagemQuery = `
      SELECT 
        imf.ds_caminho_server
      FROM mob_imagens_feridas imf
      WHERE imf.id = ? AND imf.mob_feridas_id = ?
    `;
    
    // Executar a query
    const [imagemResult] = await sequelize.query(imagemQuery, {
      replacements: [imagemId, id],
      type: sequelize.QueryTypes.SELECT
    });
    
    if (!imagemResult || !imagemResult.ds_caminho_server) {
      return res.status(404).json({ error: 'Imagem não encontrada' });
    }
    
    // Construir o caminho da imagem no S3
    const filePath = `feridas/${imagemResult.ds_caminho_server}`;
    
    // Verificar se a imagem existe no S3
    const imageExists = await fileExists(filePath);
    
    if (!imageExists) {
      return res.status(404).json({ error: 'Imagem não encontrada no S3' });
    }
    
    // Buscar a imagem do S3
    const fileStream = await getFileStream(filePath);
    
    if (!fileStream) {
      return res.status(404).json({ error: 'Erro ao buscar imagem' });
    }
    
    // Definir headers apropriados
    res.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=3600'
    });
    
    // Stream da imagem para o cliente
    if (fileStream.pipe) {
      fileStream.pipe(res);
    } else {
      // Para AWS SDK v3
      const chunks = [];
      for await (const chunk of fileStream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      res.send(buffer);
    }
    
  } catch (error) {
    console.log("ERRO em /feridas/:id/imagem/:imagemId");
    console.log(error.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Versão alternativa mais performática para anamnese completa (uma única query)
route.get("/anamneses/:id/completa-optimized", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Query SQL unificada para buscar todos os dados em uma consulta
    const query = `
      SELECT 
        a.id as anamnese_id,
        a.dt_data,
        sot.ds_pele,
        f.id as ferida_id,
        f.vl_comprimento,
        f.vl_largura,
        f.createdAt as ferida_data_envio,
        lf.ds_local_feridas as local,
        tt.ds_tipo_tecidos as tipo_tecido,
        imf.id as imagem_id,
        imf.ds_caminho_server,
        sif.vl_dimensao_ia
      FROM mob_anamneses a
      LEFT JOIN mob_sistema_oto_tegumentar sot ON a.id = sot.mob_anamneses_id
      LEFT JOIN mob_feridas f ON a.id = f.mob_anamneses_id
      LEFT JOIN mob_local_feridas lf ON f.mob_local_feridas_id = lf.id
      LEFT JOIN mob_tipo_tecidos tt ON f.mob_tipo_tecidos_id = tt.id
      LEFT JOIN mob_imagens_feridas imf ON f.id = imf.mob_feridas_id
      LEFT JOIN srv_imagens_feridas sif ON imf.id = sif.mob_imagens_feridas_id
      WHERE a.id = ?
      ORDER BY f.id, imf.id
    `;
    
    const results = await sequelize.query(query, {
      replacements: [id],
      type: sequelize.QueryTypes.SELECT
    });
    
    if (!results.length) {
      return res.status(404).json({ error: 'Anamnese não encontrada' });
    }
    
    // Pegar dados da anamnese do primeiro resultado
    const primeiroResult = results[0];
    
    // Função para buscar imagem do S3 e converter para base64
    const getImageBase64 = async (caminhoServer) => {
      try {
        if (!caminhoServer) {
          console.log('Caminho do servidor não informado');
          return null;
        }
        
        console.log(`Tentando buscar imagem: ${caminhoServer}`);
        
        // Buscar a imagem do S3 diretamente
        const fileStream = await getFileStream(caminhoServer);
        
        if (!fileStream) {
          console.log(`Imagem não encontrada: ${caminhoServer}`);
          return null;
        }
        
        console.log(`Stream obtido, convertendo para buffer: ${caminhoServer}`);
        
        // Converter stream para buffer - versão mais robusta
        let buffer;
        
        if (fileStream.pipe && typeof fileStream.on === 'function') {
          // Stream do Node.js tradicional
          const chunks = [];
          return new Promise((resolve, reject) => {
            fileStream.on('data', chunk => chunks.push(chunk));
            fileStream.on('end', () => {
              buffer = Buffer.concat(chunks);
              const base64 = buffer.toString('base64');
              resolve(`data:image/jpeg;base64,${base64}`);
            });
            fileStream.on('error', reject);
          });
        } else {
          // Para AWS SDK v3, o Body pode ser um ReadableStream
          const chunks = [];
          for await (const chunk of fileStream) {
            chunks.push(chunk);
          }
          buffer = Buffer.concat(chunks);
          const base64 = buffer.toString('base64');
          return `data:image/jpeg;base64,${base64}`;
        }
        
      } catch (error) {
        console.log(`Erro ao buscar imagem ${caminhoServer}:`, error.message);
        return null;
      }
    };
    
    // Processar os resultados para agrupar feridas e imagens
    const feridasMap = new Map();
    
    // Primeiro, agrupar os dados sem buscar as imagens
    results.forEach(row => {
      if (row.ferida_id) {
        if (!feridasMap.has(row.ferida_id)) {
          feridasMap.set(row.ferida_id, {
            id: row.ferida_id,
            local: row.local || 'Não informado',
            comprimento: row.vl_comprimento,
            largura: row.vl_largura,
            data_envio: row.ferida_data_envio,
            tipo_tecido: row.tipo_tecido || 'Não informado',
            imagens: []
          });
        }
        
        // Adicionar dados da imagem (sem o base64 ainda)
        if (row.imagem_id && row.ds_caminho_server) {
          feridasMap.get(row.ferida_id).imagens.push({
            id: row.imagem_id,
            caminho_s3: row.ds_caminho_server,
            dimensao_ia: row.vl_dimensao_ia || null,
            base64: null // Será preenchido depois
          });
        }
      }
    });
    
    // Converter Map para Array
    const feridasEstruturadas = Array.from(feridasMap.values());
    
    // Buscar base64 de todas as imagens em paralelo
    const imagensPromises = [];
    const imagensIndexes = [];
    
    feridasEstruturadas.forEach((ferida, feridaIndex) => {
      ferida.imagens.forEach((imagem, imagemIndex) => {
        if (imagem.caminho_s3) {
          imagensPromises.push(getImageBase64(imagem.caminho_s3));
          imagensIndexes.push({ feridaIndex, imagemIndex });
        }
      });
    });
    
    // Aguardar todas as imagens serem processadas
    const imagensBase64 = await Promise.allSettled(imagensPromises);
    
    // Atualizar as imagens com o base64
    imagensBase64.forEach((result, index) => {
      const { feridaIndex, imagemIndex } = imagensIndexes[index];
      if (result.status === 'fulfilled' && result.value) {
        feridasEstruturadas[feridaIndex].imagens[imagemIndex].base64 = result.value;
      } else {
        console.log(`Falha ao carregar imagem ${feridasEstruturadas[feridaIndex].imagens[imagemIndex].caminho_s3}:`, 
                   result.reason?.message || 'Erro desconhecido');
      }
    });
    
    // Estruturar resposta final
    const resposta = {
      id: primeiroResult.anamnese_id,
      dt_data: primeiroResult.dt_data,
      pele: primeiroResult.ds_pele || 'Não informado',
      feridas: feridasEstruturadas
    };
    
    res.json(resposta);
    
  } catch (error) {
    console.log("ERRO em /anamneses/:id/completa-optimized");
    console.log(error.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

route.get("/anamnsesAnimalid/:Animal_id", async (req, res) => {
  try {
    const { Animal_id, dt_data } = req.params;
    const resposta = await mob_anamneses.findAll({
      where: { mob_animais_id: Animal_id },
      order: [["dt_data", "DESC"]],
    });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log("ERRO em /anamnsesUserid");
    console.log(error.message);
  }
});

route.post("/anamneses", async (req, res) => {
  try {
    const {
      mob_usuarios_id,
      mob_animais_id,
      ds_temperamento,
      vl_peso,
      ds_talhe,
      ds_raca,
      ds_trauma,
      vl_cirurgia,
      ds_claudicacao,
      dt_data,
    } = req.body;
    const resposta = await mob_anamneses.create({
      mob_usuarios_id,
      mob_animais_id,
      ds_temperamento,
      vl_peso,
      ds_talhe,
      ds_raca,
      ds_trauma,
      vl_cirurgia,
      ds_claudicacao,
      dt_data,
    });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log("ERRO em /mob_anamneses");
    
    console.log(error.message);
  }
});

route.put("/anamneses", async (req, res) => {
  try {
    const {
      id,
      mob_usuarios_id,
      mob_animais_id,
      ds_temperamento,
      vl_peso,
      ds_talhe,
      ds_raca,
      ds_trauma,
      vl_cirurgia,
      ds_claudicacao,
      dt_data,
    } = req.body;
    const resposta = await mob_anamneses.update(
      {
        mob_usuarios_id,
        mob_animais_id,
        ds_temperamento,
        vl_peso,
        ds_talhe,
        ds_raca,
        ds_trauma,
        vl_cirurgia,
        ds_claudicacao,
        dt_data,
      },
      { where: { id } }
    );
    resposta[0] ? res.send(true) : res.send(false);
  } catch (error) {
    console.log("ERRO em /mob_anamneses");
    console.log(error.message);
  }
});

route.delete("/anamneses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_anamneses.destroy({ where: { id } });
    resposta ? res.send(true) : res.send(false);
  } catch (error) {
    console.log("ERRO em /mob_anamneses");
    console.log(error.message);
  }
});

/// route com transição

route.post("/anamnese_tegumentar", async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      mob_usuarios_id,
      mob_animais_id,
      ds_temperamento,
      vl_peso,
      ds_talhe,
      ds_raca,
      ds_trauma,
      vl_cirurgia,
      ds_claudicacao,
      dt_data,
      ds_pele,
      ds_orelha,
      ds_unha,
    } = req.body;

    const resposta = await mob_anamneses.create(
      {
        mob_usuarios_id,
        mob_animais_id,
        ds_temperamento,
        vl_peso,
        ds_talhe,
        ds_raca,
        ds_trauma,
        vl_cirurgia,
        ds_claudicacao,
        dt_data,
      },
      { transaction: t }
    );

    let mob_anamneses_id = resposta.id;
    console.log("resposta", resposta);

    if (resposta) {
      await mob_sistema_oto_tegumentar.create(
        {
          mob_anamneses_id,
          ds_pele,
          ds_orelha,
          ds_unha,
        },
        { transaction: t }
      );
    }

    await t.commit();

    resposta ? res.send(resposta) : res.send(false);

  } catch (error) {
    await t.rollback();
    console.log("ERRO em /mob_anamneses");
    console.log(error.message);
   
  }
});

route.put("/anamnese_tegumentar", async (req, res) => {

  const t = await sequelize.transaction();
  try {
    const {
      id,
      sistema_id,
      mob_usuarios_id,
      mob_animais_id,
      ds_temperamento,
      vl_peso,
      ds_talhe,
      ds_raca,
      ds_trauma,
      vl_cirurgia,
      ds_claudicacao,
      dt_data,
      ds_pele,
      ds_orelha,
      ds_unha,
    } = req.body;

    const resposta = await mob_anamneses.update(
      {
        mob_usuarios_id,
        mob_animais_id,
        ds_temperamento,
        vl_peso,
        ds_talhe,
        ds_raca,
        ds_trauma,
        vl_cirurgia,
        ds_claudicacao,
        dt_data,
      },
      { where: { id }, transaction: t }
    );

    let mob_anamneses_id = resposta.id;
    console.log("resposta", resposta);

    if (resposta) {
      const resposta = await mob_sistema_oto_tegumentar.update(
        { mob_anamneses_id, ds_pele, ds_orelha, ds_unha },
        { where: { id:sistema_id },
         transaction: t  }
      );
    }

    await t.commit();

    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    await t.rollback();
    console.log("ERRO em /mob_anamneses");
    console.log(error.message);
  }
});

module.exports = route;
