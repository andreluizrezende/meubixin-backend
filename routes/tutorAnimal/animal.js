const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_animais, mob_tutores } = models;
const Op = require('sequelize').Op;
const { sequelize } = models;
const { uploadProfilePetService } = require('../uploadImagens/service')
const { uploadFile, deleteFile, getFileStream, fileExists, getSignedUrlForDownload } = require("../../utils/s3_teste");




route.get('/animais', async (req, res) => {
  try {
    const resposta = await mob_animais.findAll({
      order: [['no_nome', 'ASC']]
    });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_animais');
    console.log(error.message);
  }
});

// Adicionar esta rota no arquivo de rotas de animais
// ANTES das rotas com parâmetros como /animais/:id para evitar conflito de rota

route.get('/animais/completo', async (req, res) => {
  try {
    console.log('🔍 Buscando todos os animais com dados dos tutores...')

    const animais = await mob_animais.findAll({
      include: [
        {
          model: mob_tutores,
          attributes: ['id', 'no_completo', 'ds_email', 'nu_telefone_completo', 'nu_cpf'],
          required: false // LEFT JOIN — retorna mesmo sem tutor vinculado
        }
      ],
      order: [['no_nome', 'ASC']]
    })

    if (!animais) {
      return res.json([])
    }

    // Mapear pro shape exato que o AnimalCard espera
    const resultado = animais.map(animal => {
      const a = animal.toJSON()
      const tutor = a.mob_tutor || a.mob_tutores || null

      return {
        id: a.id,
        mob_tutores_id: a.mob_tutores_id,
        mob_veterinarios_id: a.mob_veterinarios_id,
        mob_parcerias_id: a.mob_parcerias_id || null,
        no_nome: a.no_nome,
        ds_especie: a.ds_especie,
        mob_especies_id: a.mob_especies_id || null,
        ds_sexo: a.ds_sexo,
        ds_pelagem: a.ds_pelagem,
        vl_idade: a.vl_idade,
        vl_peso: a.vl_peso,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        // Campos extras esperados pelo AnimalCard
        avatar: a.no_nome?.charAt(0)?.toUpperCase() || '?',
        proprietario: tutor?.no_completo || 'Tutor não informado',
        email: tutor?.ds_email || 'Email não informado',
        telefone: tutor?.nu_telefone_completo || 'Telefone não informado',
        documento: tutor?.nu_cpf ? String(tutor.nu_cpf) : ''
      }
    })

    console.log(`✅ ${resultado.length} animais retornados com dados de tutores`)
    res.json(resultado)

  } catch (error) {
    console.log('ERRO em /animais/completo')
    console.log(error.message)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

route.get('/animais/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_animais.findOne({ where: { id } });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_animais');
    console.log(error.message);
  }
});

route.get('/animalNome/:no_nome', async (req, res) => {
  try {
    const { no_nome } = req.params;
    const resposta = await mob_animais.findAll({
      include: mob_tutores, where: { no_nome: { [Op.like]: `${no_nome}%` } }
    });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /animalNome');
    console.log(error.message);
  }
});

// Implementação versão 2.0
route.get('/animalNome/:no_nome/:id_tutor', async (req, res) => {

  try {
    const { no_nome, id_tutor } = req.params;
    const resposta = await mob_animais.findAll({
      where: { no_nome: { [Op.like]: `${no_nome}%` }, mob_tutores_id: id_tutor }
    });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /animalNome/:no_nome/:idTutor');
    console.log(error.message);
  }
});

// Implementação versão 2.0

route.delete('/deleteAnimal/:id_animal', async (req, res) => {

  try {
    const { id_animal } = req.params;
    await mob_animais.destroy({
      where: { id: id_animal }
    }).then(function (rowDeleted) {
      rowDeleted == 1 ? res.send(true) : res.send(false)
    })

  } catch (error) {
    console.log('ERRO em /deleteAnimal/:id_animal');
    console.log(error.message);
  }
});

route.get('/animalNomeTutor/:no_completo', async (req, res) => {
  try {
    const { no_completo } = req.params;
    const resposta = await mob_animais.findAll({
      include: [{
        model: mob_tutores,
        where: { no_completo: { [Op.like]: `${no_completo}%` } }
      }]
    });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /tutorNome');
    console.log(error.message);
  }
});

route.get('/animalCpf/:nu_cpf', async (req, res) => {
  try {
    const { nu_cpf } = req.params;
    const resposta = await mob_animais.findAll({
      include: [{
        model: mob_tutores,
        where: { nu_cpf }
      }]
    });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /tutorCpf');
    console.log(error.message);
  }
});

route.get('/animal/:id_tutor/:no_animal', async (req, res) => {
  try {
    const { id_tutor, no_animal } = req.params;
    const resposta = await mob_animais.findAll({

      where: { mob_tutores_id: id_tutor, no_nome: no_animal }

    });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /tutorCpf');
    console.log(error.message);
  }
});

route.post('/animais', async (req, res) => {
  try {
    let {
      no_nome,
      ds_especie,
      mob_especies_id,
      ds_sexo,
      ds_pelagem,
      vl_idade,
      vl_peso,
      mob_tutores_id,
      mob_veterinarios_id,
      mob_parcerias_id,
      imagem_base64 // Nova propriedade para receber a imagem
    } = req.body;

    if (vl_peso) {
      vl_peso = parseFloat(vl_peso.replace(",", "."));
    }
    if (vl_idade) {
      vl_idade = parseFloat(vl_idade.replace(",", "."));
    }

    if (Array.isArray(mob_veterinarios_id) && mob_veterinarios_id.length === 0) {
      mob_veterinarios_id = null;
    }

    console.log('vet', mob_veterinarios_id);
    console.log(vl_idade);

    // Criar o registro do animal primeiro
    const resposta = await mob_animais.create({
      no_nome,
      ds_especie,
      ds_sexo,
      ds_pelagem,
      vl_idade,
      vl_peso,
      mob_tutores_id,
      mob_veterinarios_id,
      mob_especies_id,
      mob_parcerias_id
    });

    // Se tiver imagem e o animal foi criado com sucesso
    if (imagem_base64 && resposta) {
      try {
        // Gerar a key usando o ID do animal e o nome
        const key = `${resposta.id}_${no_nome.replace(/\s+/g, '_')}`;

        // Chamar o serviço de upload
        const imagemPath = await uploadProfilePetService(imagem_base64, key);
        console.log(imagemPath)

        resposta ? res.send(resposta) : res.send(false);
      } catch (uploadError) {
        console.log('ERRO no upload da imagem do animal:', uploadError.message);
        // Continua o fluxo mesmo se o upload falhar
      }
    } else {
      resposta ? res.send(resposta) : res.send(false);
    }


  } catch (error) {
    console.log('ERRO em /mob_animais');
    console.log(error.message);
    res.status(500).send({ error: error.message });
  }
});


route.put('/animais', async (req, res) => {
  try {
    let { id, no_nome, ds_especie, ds_sexo, ds_pelagem, vl_idade, vl_peso, mob_tutores_id, mob_veterinarios_id, mob_especies_id, mob_parcerias_id, imagem_base64 } = req.body;

    if (vl_peso) {
      vl_peso = parseFloat(vl_peso.replace(",", "."));
    }
    if (vl_idade) {
      vl_idade = parseFloat(vl_idade.replace(",", "."));
    }

    // Primeiro vamos gerar a key para verificação no S3
    const key = `${id}_${no_nome.replace(/\s+/g, '_')}`;
    const filePath = `profilePet/${key}`;

    // Verificar se já existe uma imagem para esse animal no S3
    const fileStream = await getFileStream(filePath);
    const imageExists = fileStream !== undefined;



    // Se existe, excluir
    if (imageExists) {
      console.log(`Imagem de ${no_nome} encontrada. Excluindo...`);
      await deleteFile(filePath);
      console.log(`Imagem anterior excluída com sucesso!`);
    }

    // Se enviou uma nova imagem, fazer o upload
    if (imagem_base64) {
      console.log("Nova imagem recebida, realizando upload...");

      // Cria um arquivo temporário com a imagem base64
      const fs = require('fs');
      const path = require('path');
      const tempFilePath = path.resolve(__dirname, "temp.png");

      fs.writeFileSync(
        tempFilePath,
        imagem_base64.replace(/^data:image\/\w+;base64,/, ""), // Remove o prefixo se existir
        "base64"
      );

      // Cria um stream de leitura do arquivo
      const fileStream = fs.createReadStream(tempFilePath);

      // Faz upload para o S3
      await uploadFile(fileStream, filePath);

      // Remove o arquivo temporário após o upload
      fs.unlinkSync(tempFilePath);

      console.log(`Nova imagem adicionada com sucesso!`);
    }

    // Agora, depois de lidar com as imagens, atualiza os dados do animal no banco
    const resposta = await mob_animais.update(
      { no_nome, ds_especie, ds_sexo, ds_pelagem, vl_idade, vl_peso, mob_tutores_id, mob_veterinarios_id, mob_especies_id, mob_parcerias_id },
      { where: { id } }
    );

    resposta[0] ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_animais');
    console.log(error.message);
    res.status(500).send({ error: true, message: error.message });
  }
});

route.delete('/animais/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await mob_animais.destroy({ where: { id } });
    resposta ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_animais');
    console.log(error.message);
  }
});

// Adicionar esta rota no seu arquivo de rotas do backend

// Rota para servir imagens dos animais do S3
route.get('/animais/:id/imagem', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar dados do animal para gerar a key correta
    const animal = await mob_animais.findOne({ where: { id } });
    
    if (!animal) {
      return res.status(404).json({ error: 'Animal não encontrado' });
    }
    
    // Gerar a key da imagem
    const key = `${id}_${animal.no_nome.replace(/\s+/g, '_')}`;
    const filePath = `profilePet/${key}`;
    
    // Verificar se a imagem existe no S3
    const imageExists = await fileExists(filePath);
    
    if (!imageExists) {
      return res.status(404).json({ error: 'Imagem não encontrada' });
    }
    
    // Buscar a imagem do S3
    const fileStream = await getFileStream(filePath);
    
    if (!fileStream) {
      return res.status(404).json({ error: 'Erro ao buscar imagem' });
    }
    
    // Definir headers apropriados
    res.set({
      'Content-Type': 'image/jpeg', // ou image/png, dependendo do formato
      'Cache-Control': 'public, max-age=3600' // Cache por 1 hora
    });
    
    // Stream da imagem para o cliente
    if (fileStream.pipe) {
      fileStream.pipe(res);
    } else {
      // Para AWS SDK v3, o Body pode ser um ReadableStream
      const chunks = [];
      for await (const chunk of fileStream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      res.send(buffer);
    }
    
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota alternativa para verificar se animal tem imagem
route.get('/animais/:id/has-image', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar dados do animal
    const animal = await mob_animais.findOne({ where: { id } });
    
    if (!animal) {
      return res.status(404).json({ error: 'Animal não encontrado' });
    }
    
    // Gerar a key da imagem
    const key = `${id}_${animal.no_nome.replace(/\s+/g, '_')}`;
    const filePath = `profilePet/${key}`;
    
    // Verificar se existe
    const hasImage = await fileExists(filePath);
    
    res.json({ hasImage });
    
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

route.get('/prescricoes/:prescricaoId/detalhes', async (req, res) => {
  try {
    const { prescricaoId } = req.params;
    console.log("Buscando detalhes da prescrição:", prescricaoId);

    const detalhesSQL = `
      SELECT 
        a.id AS anamnese_id,
        a.dt_data_anamnese,
        a.ds_orientacoes,
        rp.dt_assinatura,
        rp.codigo_verificacao,
        rp.arquivo_s3_path,
        v.no_completo AS veterinario_nome,
        v.ds_email AS veterinario_email,
        v.nu_telefone_completo AS veterinario_telefone,
        v.nu_crmv AS veterinario_crmv,
        v.ds_estado_crmv AS veterinario_uf_crmv,
        v.ds_logo_s3 AS veterinario_logo,
        v.ds_assinatura_s3 AS veterinario_assinatura
      FROM web_anamneses a
      INNER JOIN web_registros_prescricoes rp ON rp.web_anamneses_id = a.id
      LEFT JOIN web_veterinarios v ON v.id = a.web_veterinarios_id
      WHERE a.id = :prescricaoId
        AND rp.status = 'assinada'
      LIMIT 1
    `;

    const resultado = await sequelize.query(detalhesSQL, {
      replacements: { prescricaoId },
      type: sequelize.QueryTypes.SELECT
    });

    if (resultado.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Prescrição não encontrada ou não assinada'
      });
    }

    res.json({
      success: true,
      data: resultado[0]
    });

  } catch (error) {
    console.log('ERRO em /prescricoes/:prescricaoId/detalhes');
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar detalhes da prescrição',
      error: error.message
    });
  }
});

// ========= BUSCAR ANAMNESES POR ANIMAL =========
route.get('/prescricoes/assinadas/animal/:animalId', async (req, res) => {
  try {
    const { animalId } = req.params;
    console.log("Buscando prescrições por animal (SQL, snake_case):", animalId);

    // Query SQL
    const prescricoesSQL = `
      SELECT 
        a.id AS anamnese_id,
        a.dt_data_anamnese,
        a.ds_orientacoes,
        p.id AS protocolo_id,
        ps.ds_protocolos_saude AS nome_protocolo,
        pa.id AS agenda_id,
        pa.dt_data_aplicacao,
        pa.st_concluido,
        rp.dt_assinatura,
        rp.codigo_verificacao,
        rp.arquivo_s3_path
      FROM web_anamneses a
      INNER JOIN web_registros_prescricoes rp ON rp.web_anamneses_id = a.id
        AND rp.status = 'assinada'
      INNER JOIN web_protocolos p ON p.web_anamneses_id = a.id
      LEFT JOIN mob_protocolos_saude ps ON ps.id = p.web_protocolos_saude_id
      LEFT JOIN web_protocolos_agendas pa ON pa.web_protocolos_id = p.id
      WHERE a.mob_animais_id = :animalId
      ORDER BY a.dt_data_anamnese DESC, p.id, pa.dt_data_aplicacao ASC
    `;

    // Executar query
    const results = await sequelize.query(prescricoesSQL, {
      replacements: { animalId },
      type: sequelize.QueryTypes.SELECT
    });

    // Agrupar resultados por anamnese e protocolo
    const prescricoesMap = {};

    results.forEach((row) => {
      // Criar anamnese se não existir
      if (!prescricoesMap[row.anamnese_id]) {
        prescricoesMap[row.anamnese_id] = {
          id: row.anamnese_id,
          anamnese_id: row.anamnese_id,
          dt_data: row.dt_data_anamnese,
          dt_assinatura: row.dt_assinatura,
          codigo_verificacao: row.codigo_verificacao,
          arquivo_s3_path: row.arquivo_s3_path,
          protocolos: {},
          agendas: {},
          observacoes: row.ds_orientacoes || null,
          status: 'ativa',
          progresso: {
            totalDoses: 0,
            dosesAplicadas: 0,
            percentual: 0
          }
        };
      }

      const anamnese = prescricoesMap[row.anamnese_id];

      // Criar protocolo se não existir
      if (row.protocolo_id && !anamnese.protocolos[row.protocolo_id]) {
        anamnese.protocolos[row.protocolo_id] = {
          id: row.protocolo_id,
          nome_protocolo: row.nome_protocolo || 'Protocolo não identificado',
          agendas: []
        };
        anamnese.agendas[row.protocolo_id] = [];
      }

      // Adicionar agenda
      if (row.agenda_id && anamnese.protocolos[row.protocolo_id]) {
        anamnese.protocolos[row.protocolo_id].agendas.push({
          id: row.agenda_id,
          dt_data_aplicacao: row.dt_data_aplicacao,
          st_concluido: row.st_concluido
        });
        anamnese.agendas[row.protocolo_id].push({
          id: row.agenda_id,
          dt_data_aplicacao: row.dt_data_aplicacao,
          st_concluido: row.st_concluido
        });
      }
    });

    // Calcular status e progresso
    const prescricoes = Object.values(prescricoesMap).map((anamnese) => {
      let totalDoses = 0;
      let dosesAplicadas = 0;
      let temDoseAtrasada = false;
      const agora = new Date();

      Object.values(anamnese.protocolos).forEach((protocolo) => {
        totalDoses += protocolo.agendas.length;
        protocolo.agendas.forEach((agenda) => {
          if (agenda.st_concluido === 1) dosesAplicadas++;
          else if (new Date(agenda.dt_data_aplicacao) < agora) temDoseAtrasada = true;
        });
      });

      let status = 'ativa';
      if (totalDoses === 0) status = 'pendente';
      else if (dosesAplicadas === totalDoses) status = 'finalizada';
      else if (temDoseAtrasada) status = 'atrasada';
      else if (dosesAplicadas > 0) status = 'em_andamento';

      anamnese.status = status;
      anamnese.progresso = {
        totalDoses,
        dosesAplicadas,
        percentual: totalDoses > 0 ? Math.round((dosesAplicadas / totalDoses) * 100) : 0
      };

      anamnese.protocolos = Object.values(anamnese.protocolos);

      return anamnese;
    });

    res.json(prescricoes);

  } catch (error) {
    console.log('ERRO em /prescricoes/animal/:animalId (SQL)');
    console.log(error.message);
    console.log(error)
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar prescrições do animal',
      error: error.message
    });
  }
});

// ========= BUSCAR PROTOCOLOS E DOSES POR ANAMNESE =========
route.get('/prescricao/protocolos/anamnese/:anamneseId', async (req, res) => {
  try {
    const { anamneseId } = req.params;
    console.log("Buscando protocolos e doses por anamnese:", anamneseId);

    // Buscar protocolos
    const protocolosSQL = `
      SELECT 
        p.id,
        p.web_anamneses_id,
        p.web_protocolos_saude_id,
        p.nu_doses,
        p.nu_intervalo_uso,
        p.tipo_intervalo_uso,
        p.ds_dosagem,
        p.st_tipo_protocolo,
        ps.ds_protocolos_saude as nome_protocolo,
        p.createdAt,
        p.updatedAt
      FROM web_protocolos p
      LEFT JOIN mob_protocolos_saude ps ON ps.id = p.web_protocolos_saude_id
      WHERE p.web_anamneses_id = :anamneseId
      ORDER BY p.id ASC
    `;

    const protocolos = await sequelize.query(protocolosSQL, {
      replacements: { anamneseId },
      type: sequelize.QueryTypes.SELECT
    });

    if (protocolos.length === 0) {
      return res.json([]);
    }

    // Buscar doses (agendas) de todos os protocolos
    const protocoloIds = protocolos.map(p => p.id);
    const dosesSQL = `
      SELECT 
        id,
        web_protocolos_id,
        dt_data_aplicacao,
        st_concluido,
        createdAt,
        updatedAt
      FROM web_protocolos_agendas
      WHERE web_protocolos_id IN (:protocoloIds)
      ORDER BY dt_data_aplicacao ASC
    `;

    const doses = await sequelize.query(dosesSQL, {
      replacements: { protocoloIds },
      type: sequelize.QueryTypes.SELECT
    });

    // Agrupar doses por protocolo
    const protocolosComDoses = protocolos.map(protocolo => {
      const dosesDoProtocolo = doses.filter(
        dose => dose.web_protocolos_id === protocolo.id
      );

      return {
        ...protocolo,
        doses: dosesDoProtocolo,
        total_doses: dosesDoProtocolo.length,
        doses_concluidas: dosesDoProtocolo.filter(d => d.st_concluido === 1).length
      };
    });

    res.json(protocolosComDoses);

  } catch (error) {
    console.log('ERRO em /protocolos/anamnese/:anamneseId');
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar protocolos da anamnese',
      error: error.message
    });
  }
});

// ========= CONCLUIR/DESCONCLUIR DOSE =========
route.put('/prescricao/doses/:doseId/status', async (req, res) => {
  try {
    const { doseId } = req.params;
    const { st_concluido } = req.body;

    console.log(`Atualizando status da dose ${doseId} para ${st_concluido}`);

    // Validação
    if (st_concluido !== 0 && st_concluido !== 1) {
      return res.status(400).json({
        success: false,
        message: 'Status inválido. Use 0 (não concluída) ou 1 (concluída)'
      });
    }

    // Atualizar status
    const updateSQL = `
      UPDATE web_protocolos_agendas
      SET st_concluido = :st_concluido,
          updatedAt = NOW()
      WHERE id = :doseId
    `;

    const [results] = await sequelize.query(updateSQL, {
      replacements: { doseId, st_concluido },
      type: sequelize.QueryTypes.UPDATE
    });

    if (results === 0) {
      return res.status(404).json({
        success: false,
        message: 'Dose não encontrada'
      });
    }

    // Buscar dose atualizada
    const doseSQL = `
      SELECT 
        id,
        web_protocolos_id,
        dt_data_aplicacao,
        st_concluido,
        createdAt,
        updatedAt
      FROM web_protocolos_agendas
      WHERE id = :doseId
    `;

    const [dose] = await sequelize.query(doseSQL, {
      replacements: { doseId },
      type: sequelize.QueryTypes.SELECT
    });

    res.json({
      success: true,
      message: `Dose ${st_concluido === 1 ? 'concluída' : 'marcada como pendente'} com sucesso`,
      data: dose
    });

  } catch (error) {
    console.log('ERRO em /doses/:doseId/status');
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar status da dose',
      error: error.message
    });
  }
});

// ========= BUSCAR PDF DA PRESCRIÇÃO =========
route.get('/prescricoes/:anamneseId/pdf', async (req, res) => {
  try {
    const { anamneseId } = req.params;
    const expiresIn = parseInt(req.query.expiresIn) || 3600; // 1 hora por padrão

    console.log(`Buscando PDF da prescrição ${anamneseId}`);

    // Buscar registro de prescrição assinada
    const registroSQL = `
      SELECT 
        id,
        web_anamneses_id,
        codigo_verificacao,
        status,
        arquivo_s3_path,
        hash_original,
        dt_criacao,
        dt_expiracao,
        dt_assinatura,
        dt_upload
      FROM web_registros_prescricoes
      WHERE web_anamneses_id = :anamneseId
        AND status = 'assinada'
      ORDER BY dt_assinatura DESC
      LIMIT 1
    `;

    const [registro] = await sequelize.query(registroSQL, {
      replacements: { anamneseId },
      type: sequelize.QueryTypes.SELECT
    });

    if (!registro) {
      return res.status(404).json({
        success: false,
        message: 'Prescrição assinada não encontrada'
      });
    }

    if (!registro.arquivo_s3_path) {
      return res.status(404).json({
        success: false,
        message: 'Caminho do arquivo não encontrado'
      });
    }

    // Gerar URL assinada para download
    const urlData = await getSignedUrlForDownload(registro.arquivo_s3_path, expiresIn);

    res.json({
      success: true,
      url: urlData.url,
      expiresIn: urlData.expiresIn,
      fileName: `prescricao-${registro.codigo_verificacao}.pdf`,
      codigoVerificacao: registro.codigo_verificacao,
      dataAssinatura: registro.dt_assinatura
    });

  } catch (error) {
    console.error('ERRO em /prescricoes/:anamneseId/pdf');
    console.error(error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar PDF da prescrição',
      error: error.message
    });
  }
});

// ========= ROTA ADICIONAL: BUSCAR DETALHES COMPLETOS DE UMA DOSE =========
route.get('/prescricoes/doses/:doseId', async (req, res) => {
  try {
    const { doseId } = req.params;
    console.log("Buscando detalhes da dose:", doseId);

    const doseSQL = `
      SELECT 
        pa.id,
        pa.web_protocolos_id,
        pa.dt_data_aplicacao,
        pa.st_concluido,
        pa.createdAt,
        pa.updatedAt,
        p.web_anamneses_id,
        p.ds_dosagem,
        ps.ds_protocolos_saude as nome_protocolo,
        p.st_tipo_protocolo
      FROM web_protocolos_agendas pa
      INNER JOIN web_protocolos p ON p.id = pa.web_protocolos_id
      LEFT JOIN mob_protocolos_saude ps ON ps.id = p.web_protocolos_saude_id
      WHERE pa.id = :doseId
    `;

    const [dose] = await sequelize.query(doseSQL, {
      replacements: { doseId },
      type: sequelize.QueryTypes.SELECT
    });

    if (!dose) {
      return res.status(404).json({
        success: false,
        message: 'Dose não encontrada'
      });
    }

    res.json({
      success: true,
      data: dose
    });

  } catch (error) {
    console.log('ERRO em /doses/:doseId');
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar detalhes da dose',
      error: error.message
    });
  }
});

module.exports = route;