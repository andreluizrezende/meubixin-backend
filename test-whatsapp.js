require('dotenv').config();
const axios = require('axios');

async function enviarWhatsAppTutor({ telefone, nomeAnimal, link, nomeVet }) {
  let numeroFormatado = telefone.replace(/\D/g, '');

  if (numeroFormatado.length === 11 && numeroFormatado[2] === '9') {
    numeroFormatado = numeroFormatado.substring(0, 2) + numeroFormatado.substring(3);
  }

  if (!numeroFormatado.startsWith('55')) {
    numeroFormatado = '55' + numeroFormatado;
  }

  if (numeroFormatado.length === 13 && numeroFormatado[4] === '9') {
    numeroFormatado = numeroFormatado.substring(0, 4) + numeroFormatado.substring(5);
  }

  const toNumber = `${numeroFormatado}@s.whatsapp.net`;

  const message = `📹 *Consulta Online - Meu Bixin*

Olá, tutor(a) de *${nomeAnimal}*!

O(a) Dr(a). *${nomeVet}* está aguardando você em uma videochamada para consultar *${nomeAnimal}*.

🔗 *Acesse pelo link abaixo (não precisa instalar nada):*
${link}

✅ Funciona direto no navegador, é só clicar!

Em caso de dúvidas: suporte@cicatribio.com.br

---
*Meu Bixin*`;

  console.log('── Dados formatados ──────────────────────────');
  console.log('Telefone original :', telefone);
  console.log('Número formatado  :', numeroFormatado);
  console.log('To (JID)          :', toNumber);
  console.log('──────────────────────────────────────────────');

  const payload = { to: toNumber, message };
  console.log('Payload enviado   :', JSON.stringify(payload, null, 2));

  const response = await axios.post(
    'https://coral-app-f97ui.ondigitalocean.app/send-message',
    payload,
    { headers: { 'Content-Type': 'application/json' } }
  );

  console.log('Status HTTP       :', response.status);
  console.log('Resposta da API   :', JSON.stringify(response.data, null, 2));
  return true;
}

// ── Parâmetros do teste ────────────────────────────────────────
const TELEFONE   = '5571988086776'; // formato enviado pelo frontend (com DDI)
const NOME_ANIMAL = 'Rex';
const LINK       = 'https://meet.jit.si/consulta-rex-teste';
const NOME_VET   = 'Dr. Teste';

(async () => {
  console.log('Iniciando teste de envio de WhatsApp...\n');
  try {
    await enviarWhatsAppTutor({
      telefone: TELEFONE,
      nomeAnimal: NOME_ANIMAL,
      link: LINK,
      nomeVet: NOME_VET,
    });
    console.log('\n✅ Mensagem enviada com sucesso.');
  } catch (err) {
    console.error('\n❌ Falha no envio.');
    console.error('Mensagem :', err.message);
    if (err.response) {
      console.error('Status   :', err.response.status);
      console.error('Body     :', JSON.stringify(err.response.data, null, 2));
    }
    process.exit(1);
  }
})();
