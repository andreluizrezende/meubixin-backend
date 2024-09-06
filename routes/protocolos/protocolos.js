const express = require("express");
const route = express.Router();
const models = require("../../models");
const { mob_protocolos, mob_protocolos_agendas } = models;
const moment = require("moment")

route.post("/mob_protocolos", async (req, res) => {
    try {
      const protocoloData = req.body;
  
      // Extrair as informações do protocoloData
      const {
        mob_animal_id,
        nu_doses,
        nu_intervalo_dias,
        st_tipo_protocolo,
        ds_protocolo,
      } = protocoloData;
  
      // Criar um novo protocolo no banco de dados
      const novoProtocolo = await mob_protocolos.create({
        mob_animal_id,
        nu_doses,
        nu_intervalo_dias,
        st_tipo_protocolo,
        ds_protocolo,
      });
  
      // Criação dos registros em mob_protocolos_agendas
      const agendas = [];
      const dataAtual = new Date();
  
      // Verificar se é uma única dose ou múltiplas doses
      if (nu_doses === 1) {
        agendas.push({
          mob_protocolos_id: novoProtocolo.id,
          dt_data_aplicacao: dataAtual,
          st_concluido: 1, // Marcar como concluído
        });
      } else {
        // Primeira dose
        agendas.push({
          mob_protocolos_id: novoProtocolo.id,
          dt_data_aplicacao: dataAtual,
          st_concluido: 1, // Marcar como concluído
        });
  
        // Doses seguintes
        for (let i = 2; i <= nu_doses; i++) {
          const dataAplicacao = moment(dataAtual).add(nu_intervalo_dias * (i - 1), 'days').toDate();
          agendas.push({
            mob_protocolos_id: novoProtocolo.id,
            dt_data_aplicacao: dataAplicacao,
            st_concluido: 0, // Marcar como não concluído
          });
        }
      }
  
      // Criar os registros em mob_protocolos_agendas
      await mob_protocolos_agendas.bulkCreate(agendas);
  
      // Enviar a resposta com o protocolo criado
      res.status(201).send(novoProtocolo);
    } catch (error) {
      console.log("ERRO em /mob_protocolos");
      console.log(error.message);
      res.status(500).send({ error: "Erro ao criar o protocolo" });
    }
  });
  

route.get("/mob_protocolos/:animal_id", async (req, res) => {
    try {
      const { animal_id } = req.params;
  
      // Buscar todos os protocolos associados ao animal_id fornecido
      const protocolos = await mob_protocolos.findAll({
        where: { mob_animal_id: animal_id },
      });
      // Enviar a resposta com os protocolos encontrados
      res.status(200).send(protocolos);
    } catch (error) {
      console.log("ERRO em /mob_protocolos/:animal_id");
      console.log(error.message);
      res.status(500).send({ error: "Erro ao buscar os protocolos" });
    }
  });

  route.get("/mob_protocolos_agendas/:protocolo_id", async (req, res) => {
    try {
      const { protocolo_id } = req.params;
  
      // Buscar todas as doses associadas ao protocolo_id fornecido
      const doses = await mob_protocolos_agendas.findAll({
        where: { mob_protocolos_id: protocolo_id },
      });
  
      // Enviar a resposta com as doses encontradas
      res.status(200).send(doses);
    } catch (error) {
      console.log("ERRO em /mob_protocolos_agendas/:protocolo_id");
      console.log(error.message);
      res.status(500).send({ error: "Erro ao buscar as doses do protocolo" });
    }
  });

  route.put("/mob_protocolos_agendas/:dose_id/concluir", async (req, res) => {
    try {
      const { dose_id } = req.params;
      const { st_concluido } = req.body;
  
      const [updatedRows] = await mob_protocolos_agendas.update(
        { st_concluido },
        { where: { id: dose_id } }
      );
  
      if (updatedRows === 0) {
        return res.status(404).send({ error: "Dose não encontrada" });
      }
  
      res.status(200).send({ message: "Dose atualizada com sucesso" });
    } catch (error) {
      console.log("ERRO em /mob_protocolos_agendas/:dose_id/concluir");
      console.log(error.message);
      res.status(500).send({ error: "Erro ao atualizar a dose" });
    }
  });

  route.delete("/mob_protocolos/:protocolo_id", async (req, res) => {
    try {
      const { protocolo_id } = req.params;
  
      // Excluir todas as doses associadas ao protocolo_id fornecido
      await mob_protocolos_agendas.destroy({
        where: { mob_protocolos_id: protocolo_id },
      });
  
      // Excluir o protocolo
      const deletedProtocolo = await mob_protocolos.destroy({
        where: { id: protocolo_id },
      });
  
      if (deletedProtocolo === 0) {
        return res.status(404).send({ error: "Protocolo não encontrado" });
      }
  
      res.status(200).send({ message: "Protocolo deletado com sucesso" });
    } catch (error) {
      console.log("ERRO em /mob_protocolos/:protocolo_id");
      console.log(error.message);
      res.status(500).send({ error: "Erro ao deletar o protocolo" });
    }
  });

  route.get("/imagens_protocolos/:dose_id", async (req, res) => {
    try {
      const { dose_id } = req.params;
      const resposta = await mob_protocolos_agendas.findAll({
        where: { id:dose_id },
      });
      resposta ? res.send(resposta) : res.send(false);
    } catch (error) {
      console.log("/imagens_protocolos/:dose_id");
      console.log(error.message);
    }
  });
  
  
module.exports = route;
