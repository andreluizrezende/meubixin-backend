const express = require('express');
const route = express.Router();
const models = require('../../models');
const { WebProtocolosSaude } = models;

route.get('/web_protocolos_saude', async (req, res) => {
  try {
    const resposta = await WebProtocolosSaude.findAll();
    resposta ? res.send(resposta) : res.send(false);
  } catch (error) {
    console.log('ERRO em /web_protocolos_saude');
    console.log(error.message);
    res.status(500).send({ error: 'Erro ao buscar protocolos de saúde' });
  }
});

// Descobre o id do tipo "Medicamentos" (fallback 3) — não há model para a
// tabela de tipos, então consulta direto.
async function tipoMedicamentosId() {
  try {
    const [rows] = await models.sequelize.query(
      "SELECT id FROM web_tipo_protocolos_saude WHERE ds_tipo_protocolos_saude = 'Medicamentos' LIMIT 1"
    );
    return rows && rows[0] ? rows[0].id : 3;
  } catch {
    return 3;
  }
}

// Insere um medicamento no catálogo (find-or-create por nome + tipo). Grava/
// atualiza o flag st_uso_humano (1 = uso humano; 0 = veterinário). O tipo padrão
// é "Medicamentos" quando não informado.
route.post('/web_protocolos_saude', async (req, res) => {
  const { ds_protocolos_saude, st_uso_humano } = req.body;
  let tipoId = req.body.web_tipo_protocolos_saude_id;
  if (!ds_protocolos_saude || !String(ds_protocolos_saude).trim()) {
    return res.status(400).send({ error: 'ds_protocolos_saude é obrigatório' });
  }
  try {
    if (!tipoId) tipoId = await tipoMedicamentosId();
    const nome = String(ds_protocolos_saude).trim();
    const [registro, criado] = await WebProtocolosSaude.findOrCreate({
      where: { ds_protocolos_saude: nome, web_tipo_protocolos_saude_id: tipoId },
      defaults: {
        ds_protocolos_saude: nome,
        web_tipo_protocolos_saude_id: tipoId,
        st_uso_humano: !!st_uso_humano,
      },
    });
    // Já existia e o flag veio diferente? Atualiza (ex.: marcaram uso humano depois).
    if (!criado && st_uso_humano != null && !!registro.st_uso_humano !== !!st_uso_humano) {
      registro.st_uso_humano = !!st_uso_humano;
      await registro.save();
    }
    return res.status(criado ? 201 : 200).send(registro);
  } catch (error) {
    console.log('ERRO em POST /web_protocolos_saude');
    console.log(error.message);
    return res.status(500).send({ error: 'Erro ao inserir protocolo de saúde' });
  }
});

module.exports = route;
