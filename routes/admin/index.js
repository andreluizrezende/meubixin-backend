const express = require('express');
const route = express.Router();

const Sequelize = require('sequelize');
const env = process.env.NODE_ENV || "development";
const config = require("../../config/config.json")[env];
let sequelize = new Sequelize(config)

route.get('/gettables', (req, res) => {
    response = [
        'mob_tipo_especies',
        'mob_tipo_exsudatos',
        'mob_tipo_feridas',
        'mob_tipo_pelagem',
        'mob_tipo_sintomas',
        'mob_local_feridas',
        'mob_tipo_tecidos',]
    res.send(response)
});

route.get('/gettable/:table', async (req, res) => {
    try {
        const result = await sequelize.query(`SELECT * FROM ${req.params.table}`);
        res.send(result[0]);
    } catch (error) {
        console.error(error);
        res.status(500).send('Ocorreu um erro ao buscar os dados.');
    }
});

route.put('/updatetable/:table', async (req, res) => {
    const fields = req.body.fields;
    const table = req.params.table;

    console.log("logando: ",fields);
    try {
        const fieldUpdates = Object.entries(fields)
            .filter(([key]) => key !== 'id' && key !== 'createdAt')
            .map(([key, value]) => `${key} = "${value}"`)
            .join(', ');

        const id = fields.id;
        const query = `UPDATE ${table} SET ${fieldUpdates} WHERE id = ${id}`;

        const result = await sequelize.query(query);
        res.send('ok');
    } catch (error) {
        console.error(error);
        res.status(500).send('Erro ao atualizar tabela');
    }
});

route.post('/insertintotable/:table', async (req, res) => {
    const fields = req.body.fields;
    const table = req.params.table;

    console.log("logando: ",fields);
  
    try {
      const filteredFields = Object.entries(fields)
        .filter(([key]) => key !== 'id');
  
      const fieldNames = filteredFields.map(([key]) => key);
      const fieldValues = filteredFields.map(([key, value]) => value);
  
      const placeholders = fieldValues.map(() => '?').join(',');
      const query = `INSERT INTO ${table} (${fieldNames.join(',')}) VALUES (${placeholders})`;
  
      const result = await sequelize.query(query, {
        replacements: fieldValues,
        type: sequelize.QueryTypes.INSERT
      });
  
      res.send('ok');
    } catch (error) {
      console.error(error);
      res.status(500).send('Erro ao inserir na tabela');
    }
  });

module.exports = route;