const express = require('express');
const app = express();
const cors = require('cors');
const PORT = process.env.PORT || 3030;


// middlewares
app.use(cors());
app.use(express.static('uploads'));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

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
const rotaAnamneses = require('./routes/anamneses/anamneses');
const rotaSistemaDigestorio = require('./routes/tabelasSistemas/sistemaDigestorio');
const rotaSistemaCardioRespiratorio = require('./routes/tabelasSistemas/sistemaCardioRespiratorio');
const rotaSistemaGenitoUrinario = require('./routes/tabelasSistemas/sistemaGenitoUrinario');
const rotaSistemaNervosoLocomotor = require('./routes/tabelasSistemas/sistemaNervosoLocomotor');
const rotaSistemaOtoTegumentar = require('./routes/tabelasSistemas/sistemaOtoTegumentar');
const rotaAntecedentesMorbidos = require('./routes/antecedentesMorbidos/antecedentesMorbidos');
const rotaManejo = require('./routes/manejo/manejo');
const rotaFeridas = require('./routes/feridas/feridas');
const rotaImagemFeridas = require('./routes/imagensFeridas/imagensFeridas');
const rotaUpload = require('./routes/uploadImagens/upload');
const rotaTipoVacinas = require('./routes/tabelasControle/tipoVacinas')
const rotaTipoVermifugos = require('./routes/tabelasControle/tipoVermifugos')
const adminRoutes = require('./routes/admin/index');
const rotaProtocolos = require('./routes/protocolos/protocolos')
const rotaParcerias = require('./routes/parcerias/pacerias')
const rotaEspecies = require('./routes/tabelasControle/tipoEspecie')
const rotaTipoFeridas = require('./routes/tabelasControle/tipoFeridas')
const rotaProtocolosSaude = require('./routes/tabelasControle/mob_protocolos_saude')
const rotaVeterinario = require('./routes/veterinarios/veterinarios')
const rotaMedicamento = require('./routes/medicamentos/medicamentos')

app.use('/admin', adminRoutes);
app.use(rotaInicial);
app.use(rotaUsuarios);
app.use(rotaLocalFeridas);
app.use(rotaQtdExsudatos);
app.use(rotaTipoExsudato);
app.use(rotaTipoSintomas);
app.use(rotaTipoTecidos);
app.use(rotaTutores);
app.use(rotaAnimais);
app.use(rotaAnamneses);
app.use(rotaSistemaDigestorio);
app.use(rotaSistemaCardioRespiratorio);
app.use(rotaSistemaGenitoUrinario);
app.use(rotaSistemaNervosoLocomotor);
app.use(rotaSistemaOtoTegumentar);
app.use(rotaAntecedentesMorbidos);
app.use(rotaManejo);
app.use(rotaFeridas);
app.use(rotaImagemFeridas);
app.use(rotaUpload);
app.use(rotaTipoVacinas);
app.use(rotaTipoVermifugos);
app.use(rotaProtocolos);
app.use(rotaParcerias);
app.use(rotaEspecies);
app.use(rotaTipoFeridas);
app.use(rotaProtocolosSaude);
app.use(rotaVeterinario);
app.use(rotaMedicamento);

app.listen(PORT, () => console.log(`running on port: ${PORT}`));