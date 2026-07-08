const express = require("express");
const route = express.Router();
const models = require("../../models");
const { mob_imagens_feridas, sequelize } = models;
const { uploadFile, deleteFile, getFileStream, fileExists } = require("../../utils/s3_teste");

route.get("/imagens_feridas", async (req, res) => {
  try {
    const resposta = await mob_imagens_feridas.findAll();
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log("ERRO em /mob_imagens_feridas");
    console.log(error.message);
  }
});

route.get("/imagens_feridas/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_imagens_feridas.findOne({ where: { id } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log("ERRO em /mob_imagens_feridas");
    console.log(error.message);
  }
});

route.get("/imagens_feridasByIdFerida/:mob_feridas_id", async (req, res) => {
  try {
    const { mob_feridas_id } = req.params;
    const resposta = await mob_imagens_feridas.findAll({
      where: { mob_feridas_id },
    });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log("ERRO em /mob_imagens_feridas");
    console.log(error.message);
  }
});

route.get(
  "/feridas_dimensoes/:mob_animais_id/:mob_usuarios_id/:anamnese_id/:mob_local_feridas_id",
  async (req, res) => {
    try {
      const {
        mob_animais_id,
        mob_usuarios_id,
        anamnese_id,
        mob_local_feridas_id,
      } = req.params;
      const query = `
      SELECT a.vl_dimensao_ia, d.dt_data, d.id
      FROM srv_imagens_feridas a, mob_imagens_feridas b, mob_feridas c, mob_anamneses d
      WHERE
        d.mob_animais_id = ${mob_animais_id} AND
        d.mob_usuarios_id = ${mob_usuarios_id} AND
        d.id NOT IN (${anamnese_id}) AND
        c.mob_anamneses_id = d.id AND
        b.mob_feridas_id = c.id AND
        c.mob_local_feridas_id = ${mob_local_feridas_id} AND
        a.mob_imagens_feridas_id = b.id
      ORDER BY d.dt_data DESC
      LIMIT 1;
    `;
      const query_2 = `
    select  a.vl_dimensao_ia, d.dt_data, d.id from srv_imagens_feridas a, 
    mob_imagens_feridas b, mob_feridas c, mob_anamneses d  
    where d.mob_animais_id = ${mob_animais_id} AND
        d.mob_usuarios_id = ${mob_usuarios_id} AND
        d.dt_data < (select x.dt_data from mob_anamneses 
        x where x.id = ${anamnese_id}) AND
        c.mob_anamneses_id = d.id AND
        b.mob_feridas_id = c.id AND
        c.mob_local_feridas_id = ${mob_local_feridas_id} AND
        a.mob_imagens_feridas_id = b.id
      ORDER BY d.dt_data DESC
      LIMIT 1;
    `;

      const resultado = await sequelize.query(query_2, {
        type: sequelize.QueryTypes.SELECT,
      });
      console.log("Resultado:", resultado);

      if (resultado.length > 0) {
        res.send(resultado[0]);
      } else {
        res.send(false);
      }
    } catch (error) {
      console.log("Erro ao processar a consulta");
      console.error(error);
      res.status(500).send("Erro ao buscar imagens de feridas");
    }
  }
);

route.get(
  "/grafico_dimensoes/:mob_animais_id/:mob_usuarios_id/:mob_local_feridas_id/:limit",
  async (req, res) => {
    try {
      const {
        mob_animais_id,
        mob_usuarios_id,
        mob_local_feridas_id,
        limit
      } = req.params;

      const query_2 = `
select  a.vl_dimensao_ia, d.dt_data, d.id from srv_imagens_feridas a, 
    mob_imagens_feridas b, mob_feridas c, mob_anamneses d  
    where d.mob_animais_id = ${mob_animais_id} AND
        d.mob_usuarios_id = ${mob_usuarios_id} AND
        c.mob_anamneses_id = d.id AND
        b.mob_feridas_id = c.id AND
        c.mob_local_feridas_id = ${mob_local_feridas_id} AND
        a.mob_imagens_feridas_id = b.id
      ORDER BY d.dt_data DESC
      LIMIT ${limit};
    `;

      const resultado = await sequelize.query(query_2, {
        type: sequelize.QueryTypes.SELECT,
      });
      console.log("Resultado:", resultado);

      if (resultado.length > 0) {
        res.send(resultado);
      } else {
        res.send(false);
      }
    } catch (error) {
      console.log("Erro ao processar a consulta");
      console.error(error);
      res.status(500).send("Erro ao buscar imagens de feridas");
    }
  }
);

// Substitua a rota original por esta versão com JOIN do CRMV

// NOVA ROTA: Gráfico de dimensões para veterinários web
route.get(
  "/grafico_dimensoes_vet/:mob_animais_id/:nu_crmv/:ds_estado_crmv/:mob_local_feridas_id/:limit",
  async (req, res) => {
    try {
      const {
        mob_animais_id,
        nu_crmv,
        ds_estado_crmv,
        mob_local_feridas_id,
        limit
      } = req.params;

      console.log('📊 Buscando gráfico para veterinário:', { nu_crmv, ds_estado_crmv, mob_animais_id });

      const query = `
        SELECT a.vl_dimensao_ia, d.dt_data, d.id, b.ds_caminho_server
        FROM srv_imagens_feridas a, 
             mob_imagens_feridas b, 
             mob_feridas c, 
             mob_anamneses d, 
             mob_animais e, 
             mob_veterinarios v
        WHERE v.nu_crmv = ${nu_crmv} AND 
              v.ds_estado_crmv = '${ds_estado_crmv}' AND
              e.mob_veterinarios_id = v.id AND
              d.mob_animais_id = e.id AND
              d.mob_animais_id = ${mob_animais_id} AND
              c.mob_anamneses_id = d.id AND
              b.mob_feridas_id = c.id AND
              c.mob_local_feridas_id = ${mob_local_feridas_id} AND
              a.mob_imagens_feridas_id = b.id
        ORDER BY d.dt_data DESC
        LIMIT ${limit};
      `;

      const resultado = await sequelize.query(query, {
        type: sequelize.QueryTypes.SELECT,
      });

      console.log(`✅ Encontrados ${resultado.length} registros para o gráfico`);

      if (resultado.length === 0) {
        console.log('❌ Nenhum resultado encontrado - animal pode não pertencer ao veterinário');
        return res.send(false);
      }

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

      // Buscar base64 de todas as imagens em paralelo
      const imagensPromises = resultado.map(registro => 
        getImageBase64(registro.ds_caminho_server)
      );

      // Aguardar todas as imagens serem processadas
      const imagensBase64 = await Promise.allSettled(imagensPromises);

      // Montar resposta final com base64
      const resultadoComImagens = resultado.map((registro, index) => {
        const imagemResult = imagensBase64[index];
        
        return {
          vl_dimensao_ia: registro.vl_dimensao_ia,
          dt_data: registro.dt_data,
          id: registro.id,
          imagem_base64: imagemResult.status === 'fulfilled' ? imagemResult.value : null
        };
      });

      // Log das imagens que falharam
      imagensBase64.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.log(`Falha ao carregar imagem ${resultado[index].ds_caminho_server}:`, 
                     result.reason?.message || 'Erro desconhecido');
        }
      });

      console.log(`✅ Processadas ${resultadoComImagens.length} imagens para o gráfico`);
      res.send(resultadoComImagens);

    } catch (error) {
      console.log("❌ Erro ao processar a consulta do gráfico para veterinário");
      console.error(error);
      res.status(500).send("Erro ao buscar dados do gráfico");
    }
  }
);

// ROTA ATUALIZADA: Buscar animais por CRMV do veterinário (substitui a rota /veterinarios/:id/animais)
route.get('/veterinarios/:nu_crmv/:ds_estado_crmv/animais', async (req, res) => {
  try {
    const { nu_crmv, ds_estado_crmv } = req.params;
    
    console.log('🐾 Buscando animais para veterinário:', { nu_crmv, ds_estado_crmv });

    // Query para buscar todos os animais que pertencem a veterinários com esse CRMV
    const query = `
      SELECT DISTINCT a.* 
      FROM mob_animais a, mob_veterinarios v
      WHERE v.nu_crmv = ${nu_crmv} AND 
            v.ds_estado_crmv = '${ds_estado_crmv}' AND
            a.mob_veterinarios_id = v.id
      ORDER BY a.no_nome ASC;
    `;

    const resultado = await sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT,
    });

    console.log(`✅ Encontrados ${resultado.length} animais para o veterinário`);

    if (resultado.length > 0) {
      res.send(resultado);
    } else {
      console.log('❌ Nenhum animal encontrado para este veterinário');
      res.send(false);
    }
  } catch (error) {
    console.log('❌ Erro em /veterinarios/crmv/animais');
    console.error(error.message);
    res.status(500).send("Erro ao buscar animais do veterinário");
  }
});


route.post("/imagens_feridas", async (req, res) => {
  try {
    const {
      mob_feridas_id,
      vl_largura_imagem,
      vl_altura_imagem,
      vl_largura_detector,
      vl_altura_detector,
      vl_eixo_x,
      vl_eixo_y,
    } = req.body;
    const resposta = await mob_imagens_feridas.create({
      mob_feridas_id,
      vl_largura_imagem,
      vl_altura_imagem,
      vl_largura_detector,
      vl_altura_detector,
      vl_eixo_x,
      vl_eixo_y,
    });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log("ERRO em /mob_imagens_feridas");
    console.log(error.message);
  }
});

route.put("/imagens_feridas", async (req, res) => {
  try {
    const {
      id,
      mob_feridas_id,
      ds_camino_server,
      vl_largura_imagem,
      vl_altura_imagem,
      vl_largura_detector,
      vl_altura_detector,
      vl_eixo_x,
      vl_eixo_y,
    } = req.body;
    const resposta = await mob_imagens_feridas.update(
      {
        mob_feridas_id,
        ds_camino_server,
        vl_largura_imagem,
        vl_altura_imagem,
        vl_largura_detector,
        vl_altura_detector,
        vl_eixo_x,
        vl_eixo_y,
      },
      { where: { id } }
    );
    resposta[0] ? res.send(true) : res.send(false);
  } catch (error) {
    console.log("ERRO em /mob_imagens_feridas");
    console.log(error.message);
  }
});

route.delete("/imagens_feridas/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_imagens_feridas.destroy({ where: { id } });
    resposta ? res.send(true) : res.send(false);
  } catch (error) {
    console.log("ERRO em /mob_imagens_feridas");
    console.log(error.message);
  }
});

route.delete(
  "/imagens_feridasByFeridasId/:mob_feridas_id",
  async (req, res) => {
    try {
      const { mob_feridas_id } = req.params;
      const resposta = await mob_imagens_feridas.destroy({
        where: { mob_feridas_id },
      });
      resposta ? res.send(true) : res.send(false);
    } catch (error) {
      console.log("ERRO em /mob_imagens_feridas");
      console.log(error.message);
    }
  }
);

route.delete("/imagens_feridasByKey/:key", async (req, res) => {
  try {
    const { key } = req.params;
    const ds_caminho_server = key.split(".")[0];
    const resposta = await mob_imagens_feridas.destroy({
      where: { ds_caminho_server },
    });
    resposta ? res.send(true) : res.send(false);
  } catch (error) {
    console.log("ERRO em /mob_imagens_feridas");
    console.log(error.message);
  }
});

module.exports = route;
