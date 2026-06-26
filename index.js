require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const PORT = process.env.PORT || 3030;


// middlewares
app.use(cors());

// Webhook do Stripe precisa do corpo CRU para validar a assinatura.
// Deve ser montado ANTES do express.json global.
const rotaWebhookStripe = require('./routes/webhooks/stripe');
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }), rotaWebhookStripe);

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
const rotaWebProtocolosSaude = require('./routes/tabelasControle/web_protocolos_saude')
const rotaVeterinario = require('./routes/veterinarios/veterinarios')
const rotaMedicamento = require('./routes/medicamentos/medicamentos')
const rotaResetPass = require('./routes/resetPassword/resetPassword')
const rotaPrescricoes = require('./routes/prescricoes/prescricoes')
const rotaParceiros = require('./routes/parceiros/paceiros')
const rotaAi = require('./routes/apiAI/apiAi')
const rotaConferencias = require('./routes/conferencias/conferencias')
const rotaConnect = require('./routes/connect/connect')
const rotaCobrancas = require('./routes/cobrancas/cobrancas')
const rotaAssinatura = require('./routes/assinatura/assinatura')
const rotaPublicoPagamento = require('./routes/publico/publico')

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
app.use(rotaWebProtocolosSaude);
app.use(rotaVeterinario);
app.use(rotaMedicamento);
app.use(rotaResetPass);
app.use(rotaPrescricoes);
app.use(rotaParceiros);
app.use(rotaAi);
app.use(rotaConferencias);
app.use(rotaConnect);
app.use(rotaCobrancas);
app.use(rotaAssinatura);
app.use(rotaPublicoPagamento);

if (require.main === module) {
  app.listen(PORT, () => console.log(`running on port: ${PORT}`))
}

module.exports = app