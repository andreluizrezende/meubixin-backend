const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_animais, mob_tutores } = models;
const Op = require('sequelize').Op;
const { uploadProfilePetService } = require('../uploadImagens/service')
const { uploadFile, deleteFile, getFileStream } = require("../../utils/s3_teste");



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

module.exports = route;