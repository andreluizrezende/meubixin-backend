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
      chronicDiseases,
      neutered,
      lang = "pt-br",
    } = req.body;

    // Só entram no prompt os campos PREENCHIDOS — antes mandava "Species: undefined"
    // quando o dado faltava, o que só polui o contexto da IA.
    const prompt = [
      species && `Species: ${species}`,
      age && `Age: ${age}`,
      gender && `Gender: ${gender}`,
      neutered && `Neutered: ${neutered}`,
      chronicDiseases && `Chronic diseases: ${chronicDiseases}`,
      anamnesis && `Anamnesis: ${anamnesis}`,
      clinicalExamination && `Clinical examination: ${clinicalExamination}`,
    ]
      .filter(Boolean)
      .join("\n\n");

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