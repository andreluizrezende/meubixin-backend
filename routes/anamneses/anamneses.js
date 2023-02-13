const express = require("express");
const route = express.Router();
const models = require("../../models");
const { mob_anamneses } = models;
const sequelize = require("sequelize");

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
    console.log("resposta", resposta)

    if (resposta) {
      await mob_sistema_oto_tegumentar.create({
        mob_anamneses_id,
        ds_pele,
        ds_orelha,
        ds_unha,
      } ,
      { transaction: t });
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
