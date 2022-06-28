const express = require('express');
const app = express();
const cors = require('cors');
const PORT = 3000;

// middlewares
app.use(express.json());
app.use(cors());

// routes
const rotaInicial = require('./routes/initial');
const rotaUsuarios = require('./routes/usuarios/usuarios');
const rotaLocalFeridas = require('./routes/tabelasControle/localFeridas');
const rotaQtdExsudatos = require('./routes/tabelasControle/qtdExsudatos');
const rotaTipoExsudato = require('./routes/tabelasControle/tipoExsudato');
const rotaTipoSintomas = require('./routes/tabelasControle/tipoSintomas');
const rotaTipoTecidos = require('./routes/tabelasControle/tipoTecidos');
const rotaTutores = require('./routes/tutorAnimal/tutor');
const rotaAnimais = require('./routes/tutorAnimal/animal');

app.use('/', rotaInicial);
app.use('/', rotaUsuarios);
app.use('/', rotaLocalFeridas);
app.use('/', rotaQtdExsudatos);
app.use('/', rotaTipoExsudato);
app.use('/', rotaTipoSintomas);
app.use('/', rotaTipoTecidos);
app.use('/', rotaTutores);
app.use('/', rotaAnimais);

app.listen(PORT, () => console.log(`running on port: ${PORT}`));