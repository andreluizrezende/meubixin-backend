const express = require("express");
const route = express.Router();
const models = require("../../models");
const { mob_imagens_feridas } = models;
const Sequelize = require("sequelize");
const config = require("../../config/config.json")["production"];
let sequelize = new Sequelize(config);

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
