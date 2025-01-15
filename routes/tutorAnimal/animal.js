const express = require('express');
const route = express.Router();
const models = require('../../models');
const { mob_animais, mob_tutores } = models;
const Op = require('sequelize').Op;

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
     where: { no_nome: { [Op.like]: `${no_nome}%`}, mob_tutores_id: id_tutor  }
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
     where: { id: id_animal  }
    }).then(function(rowDeleted){
      rowDeleted == 1? res.send(true):res.send(false)
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

        where: {mob_tutores_id: id_tutor, no_nome: no_animal  }
      
    });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /tutorCpf');
    console.log(error.message);
  }
});

route.post('/animais', async (req, res) => {
  try {
    let { no_nome, ds_especie,mob_especies_id, ds_sexo, ds_pelagem, vl_idade, vl_peso, mob_tutores_id, mob_veterinarios_id } = req.body;

    if (vl_peso) {
      vl_peso = parseFloat(vl_peso.replace(",", "."));
    }
    if (vl_idade) {
      vl_idade = parseFloat(vl_idade.replace(",", "."));
    }

    console.log(vl_idade)

    const resposta = await mob_animais.create({ no_nome, ds_especie, ds_sexo, ds_pelagem, vl_idade, vl_peso, mob_tutores_id, mob_veterinarios_id, mob_especies_id });
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_animais');
    console.log(error.message);
  }
});


route.put('/animais', async (req, res) => {
  try {
    let{ id, no_nome, ds_especie, ds_sexo, ds_pelagem, vl_idade,vl_peso, mob_tutores_id, mob_veterinarios_id  } = req.body;
    if (vl_peso) {
      vl_peso = parseFloat(vl_peso.replace(",", "."));
    }
    if (vl_idade) {
      vl_idade = parseFloat(vl_idade.replace(",", "."));
    }
    const resposta = await mob_animais.update({ no_nome, ds_especie, ds_sexo, ds_pelagem, vl_idade,vl_peso, mob_tutores_id, mob_veterinarios_id  }, { where: { id } });
    resposta[0] ? res.send(true) : res.send(false);
  } catch (error) {
    console.log('ERRO em /mob_animais');
    console.log(error.message);
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