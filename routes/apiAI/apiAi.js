const express = require("express");
const route = express.Router();
const fetch = require("node-fetch");

const AI_BASE_URL = "https://ai.zlife.pet";
const AI_TOKEN = "c23fd757-d9b6-417d-a270-a4b4b29d5410";

const aiHeaders = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${AI_TOKEN}`,
};

// Rota para diagnóstico por texto (anamnese + exame clínico)
route.post("/ia/diagnostico", async (req, res) => {
  try {
    const {
      species,
      age,
      gender,
      anamnesis,
      clinicalExamination,
      lang = "pt-br",
    } = req.body;

    const prompt =
      `Species: ${species}\n\n` +
      `Age: ${age}\n\n` +
      `Gender: ${gender}\n\n` +
      `Anamnesis: ${anamnesis}\n\n` +
      `Clinical examination: ${clinicalExamination}`;

    const resposta = await fetch(`${AI_BASE_URL}/question/diseases`, {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify({ lang, prompt }),
    });

    const data = await resposta.json();
    data ? res.send(data) : res.send(false);
  } catch (error) {
    console.log("ERRO em /ia/diagnostico");
    console.log(error.message);
  }
});

// Rota para análise de imagem de ferida/lesão
route.post("/ia/imagem", async (req, res) => {
  try {
    const { url, context, lang = "pt-br" } = req.body;

    const resposta = await fetch(`${AI_BASE_URL}/analyse-images`, {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify({ url, context, lang }),
    });

    const data = await resposta.json();
    data ? res.send(data) : res.send(false);
  } catch (error) {
    console.log("ERRO em /ia/imagem");
    console.log(error.message);
  }
});

// Rota para análise de laudo em PDF
route.post("/ia/documento", async (req, res) => {
  try {
    const { url, context, lang = "pt-br" } = req.body;

    const resposta = await fetch(`${AI_BASE_URL}/analyse-documents`, {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify({ url, mimeType: "application/pdf", context, lang }),
    });

    const data = await resposta.json();
    data ? res.send(data) : res.send(false);
  } catch (error) {
    console.log("ERRO em /ia/documento");
    console.log(error.message);
  }
});

module.exports = route;