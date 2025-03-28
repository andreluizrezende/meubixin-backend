const express = require("express");
const route = express.Router();
const models = require("../../models");
const { MobParcerias, mob_tipo_parcerias } = models;
const Sequelize = require("sequelize");
const env = process.env.NODE_ENV || "production";
const config = require("../../config/config.json")[env];

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

// Rota para criar uma nova parceria
route.post("/parcerias", async (req, res) => {
  console.log("CHou aqui", req.body);
  try {
    const {
      mob_usuarios_id,
      no_nome_parceiro,
      mob_tipo_parcerias_id,
      ds_estado,
      ds_cidade,
      nu_cep,
      nu_telefone_completo,
      ds_site,
      ds_instagram,
    } = req.body;

    const resposta = await MobParcerias.create({
      mob_usuarios_id,
      no_nome_parceiro,
      mob_tipo_parcerias_id,
      ds_estado,
      ds_cidade,
      nu_cep,
      nu_telefone_completo,
      ds_site,
      ds_instagram,
    });

    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log("ERRO em /mob_parcerias");
    console.log(error.message);
  }
});

// Rota para atualizar uma parceria existente
route.put("/parcerias/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      mob_usuarios_id,
      no_nome_parceiro,
      mob_tipo_parcerias_id,
      ds_estado,
      ds_cidade,
      nu_cep,
      nu_telefone_completo,
      ds_site,
      ds_instagram,
    } = req.body;

    console.log("Dados que chegam para a atualização", req.body);

    const resposta = await MobParcerias.update(
      {
        mob_usuarios_id,
        no_nome_parceiro,
        mob_tipo_parcerias_id,
        ds_estado,
        ds_cidade,
        nu_cep,
        nu_telefone_completo,
        ds_site,
        ds_instagram,
      },
      { where: { id } }
    );

    resposta[0] ? res.send(true) : res.send(false);
  } catch (error) {
    console.log("ERRO em /mob_parcerias");
    console.log(error.message);
  }
});

// Rota para deletar uma parceria existente
route.delete("/parcerias/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const resposta = await MobParcerias.destroy({ where: { id } });
    resposta ? res.send(true) : res.send(false);
  } catch (error) {
    console.log("ERRO em /mob_parcerias");
    console.log(error.message);
  }
});

// Rota para buscar todas as parcerias de um usuário específico
route.get("/parcerias/usuario/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const resposta = await MobParcerias.findAll({
      where: { mob_usuarios_id: userId },
      order: [["createdAt", "DESC"]],
    });
    console.log(resposta);
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log("ERRO em /mob_parcerias");
    console.log(error.message);
  }
});

// Rota para buscar todas as parcerias de um usuário específico
route.get("/parcerias", async (req, res) => {
  try {
    const resposta = await MobParcerias.findAll();
    console.log(resposta);
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log("ERRO em /mob_parcerias");
    console.log(error.message);
  }
});

route.get("/tipo/parcerias", async (req, res) => {
  try {
    const resposta = await mob_tipo_parcerias.findAll();
    console.log(resposta);
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log("ERRO em /tipo/parceirias");
    console.log(error.message);
  }
});

// Rota para buscar parcerias pelo estado e cidade
route.get("/parcerias/localizacao", async (req, res) => {
  try {
    const { estado, cidade } = req.query;

    if (!estado || !cidade) {
      return res.status(400).send({ message: "Estado e cidade são obrigatórios." });
    }

    const resposta = await MobParcerias.findAll({
      where: {
        ds_estado: estado,
        ds_cidade: cidade,
      },
      order: [["createdAt", "DESC"]],
    });

    resposta.length ? res.send(resposta) : res.send([]);
  } catch (error) {
    console.log("ERRO em /parcerias/localizacao");
    console.log(error.message);
    res.status(500).send({ message: "Erro ao buscar parcerias por localização." });
  }
});

module.exports = route;
