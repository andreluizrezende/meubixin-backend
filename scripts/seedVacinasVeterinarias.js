'use strict';
/*
 * Semeia web_produtos_veterinarios com um catálogo CURADO de vacinas veterinárias
 * usadas no Brasil (cães, gatos, bovinos, equinos). Necessário porque não há fonte
 * aberta/raspável de vacinas (Cobasi não vende; MAPA "Produtos Biológicos" é painel
 * Qlik bloqueado). Domínio pequeno e estável → lista curada é mais confiável que
 * scraper. Compilado de referências públicas (fabricantes/linhas conhecidas).
 *
 * Grava com fonte='curado', subcategoria='Vacina' (a rota /produtos-veterinarios
 * ?tipo=vacina e a aba de Vacinas já filtram por essa subcategoria). Idempotente:
 * upsert por (fonte, id_externo). NÃO tem nº de registro MAPA — é referência clínica.
 *
 * Uso:
 *   node scripts/seedVacinasVeterinarias.js
 *   NODE_ENV=production node scripts/seedVacinasVeterinarias.js
 */
require('dotenv').config();
const models = require('../models');
const { WebProdutosVeterinarios, sequelize } = models;

// composicao = antígenos/doenças cobertas; indicacao = uso; via = aplicação.
const VACINAS = [
  // ---------------- CÃES ----------------
  { nome: 'Vacina Múltipla V8 (Óctupla) Canina', marca: null, especie: 'Cachorro', composicao: 'Cinomose, Adenovirose (hepatite infecciosa/adenovírus tipo 1 e 2), Parvovirose, Coronavirose, Parainfluenza, Leptospirose (2 sorovares)', indicacao: 'Imunização de cães contra as principais viroses e leptospirose (2 sorovares)', via: 'Subcutânea' },
  { nome: 'Vacina Múltipla V10 (Décupla) Canina', marca: null, especie: 'Cachorro', composicao: 'Cinomose, Adenovirose (hepatite/adenovírus tipo 1 e 2), Parvovirose, Coronavirose, Parainfluenza, Leptospirose (4 sorovares)', indicacao: 'Imunização de cães; amplia a cobertura de leptospirose para 4 sorovares em relação à V8', via: 'Subcutânea' },
  { nome: 'Vanguard Plus V10 (HTLP 5/CV-L)', marca: 'Zoetis', especie: 'Cachorro', composicao: 'Cinomose, Adenovírus tipo 1 e 2, Parvovírus, Parainfluenza, Coronavírus, Leptospira (4 sorovares)', indicacao: 'Vacina polivalente canina', via: 'Subcutânea' },
  { nome: 'Nobivac DHPPi + L (Cães)', marca: 'MSD Saúde Animal', especie: 'Cachorro', composicao: 'Cinomose, Hepatite (adenovírus), Parvovirose, Parainfluenza, Leptospirose', indicacao: 'Vacina polivalente canina', via: 'Subcutânea' },
  { nome: 'Recombitek C6/CV', marca: 'Boehringer Ingelheim', especie: 'Cachorro', composicao: 'Cinomose, Adenovírus tipo 2, Parvovírus, Parainfluenza, Coronavírus, Leptospira', indicacao: 'Vacina polivalente canina', via: 'Subcutânea' },
  { nome: 'Vacina Antirrábica Canina', marca: null, especie: 'Cachorro', composicao: 'Vírus da raiva inativado', indicacao: 'Prevenção da raiva; obrigatória por lei. Reforço anual', via: 'Subcutânea' },
  { nome: 'Defensor 3 (Antirrábica)', marca: 'Zoetis', especie: 'Cachorro', composicao: 'Vírus da raiva inativado', indicacao: 'Prevenção da raiva em cães e gatos', via: 'Subcutânea' },
  { nome: 'Nobivac Raiva', marca: 'MSD Saúde Animal', especie: 'Cachorro', composicao: 'Vírus da raiva inativado', indicacao: 'Prevenção da raiva em cães e gatos', via: 'Subcutânea' },
  { nome: 'Vacina contra Giárdia (Giardíase)', marca: null, especie: 'Cachorro', composicao: 'Giardia lamblia (antígenos)', indicacao: 'Prevenção da giardíase; 2 doses iniciais e reforço anual', via: 'Subcutânea' },
  { nome: 'Vacina contra Tosse dos Canis', marca: null, especie: 'Cachorro', composicao: 'Bordetella bronchiseptica + Parainfluenza canina', indicacao: 'Prevenção da traqueobronquite infecciosa canina (tosse dos canis)', via: 'Intranasal ou Oral' },
  { nome: 'Nobivac KC', marca: 'MSD Saúde Animal', especie: 'Cachorro', composicao: 'Bordetella bronchiseptica + Parainfluenza canina', indicacao: 'Prevenção da tosse dos canis', via: 'Intranasal' },
  { nome: 'Bronchi-Shield Oral', marca: 'Zoetis', especie: 'Cachorro', composicao: 'Bordetella bronchiseptica', indicacao: 'Prevenção da tosse dos canis', via: 'Oral' },
  { nome: 'Vacina contra Gripe Canina (Influenza)', marca: null, especie: 'Cachorro', composicao: 'Vírus influenza canina (H3N8 e/ou H3N2) inativado', indicacao: 'Prevenção da influenza canina', via: 'Subcutânea' },
  { nome: 'Leish-Tec (Leishmaniose Visceral Canina)', marca: 'Ceva', especie: 'Cachorro', composicao: 'Antígeno A2 recombinante de Leishmania', indicacao: 'Prevenção da leishmaniose visceral canina; 3 doses iniciais e reforço anual', via: 'Subcutânea' },

  // ---------------- GATOS ----------------
  { nome: 'Vacina Tríplice Felina (V3)', marca: null, especie: 'Gato', composicao: 'Panleucopenia felina, Rinotraqueíte (herpesvírus felino), Calicivirose', indicacao: 'Imunização básica de gatos contra as principais viroses respiratórias e panleucopenia', via: 'Subcutânea' },
  { nome: 'Vacina Quádrupla Felina (V4)', marca: null, especie: 'Gato', composicao: 'Panleucopenia, Rinotraqueíte, Calicivirose, Clamidiose', indicacao: 'Tríplice felina + clamidiose', via: 'Subcutânea' },
  { nome: 'Vacina Quíntupla Felina (V5)', marca: null, especie: 'Gato', composicao: 'Panleucopenia, Rinotraqueíte, Calicivirose, Clamidiose, Leucemia felina (FeLV)', indicacao: 'Quádrupla felina + leucemia felina (FeLV)', via: 'Subcutânea' },
  { nome: 'Nobivac Tricat', marca: 'MSD Saúde Animal', especie: 'Gato', composicao: 'Panleucopenia, Rinotraqueíte, Calicivirose', indicacao: 'Vacina tríplice felina', via: 'Subcutânea' },
  { nome: 'Felocell CVR', marca: 'Zoetis', especie: 'Gato', composicao: 'Rinotraqueíte, Calicivirose, Panleucopenia', indicacao: 'Vacina tríplice felina', via: 'Subcutânea' },
  { nome: 'Purevax RCP', marca: 'Boehringer Ingelheim', especie: 'Gato', composicao: 'Rinotraqueíte, Calicivirose, Panleucopenia', indicacao: 'Vacina felina não adjuvantada', via: 'Subcutânea' },
  { nome: 'Vacina contra Leucemia Felina (FeLV)', marca: null, especie: 'Gato', composicao: 'Vírus da leucemia felina (FeLV)', indicacao: 'Prevenção da leucemia felina; recomenda-se testagem prévia', via: 'Subcutânea' },
  { nome: 'Vacina Antirrábica Felina', marca: null, especie: 'Gato', composicao: 'Vírus da raiva inativado', indicacao: 'Prevenção da raiva em gatos; reforço anual', via: 'Subcutânea' },

  // ---------------- BOVINOS / GRANDES ANIMAIS ----------------
  { nome: 'Vacina contra Febre Aftosa', marca: null, especie: 'Bovinos', composicao: 'Vírus da febre aftosa inativado', indicacao: 'Prevenção da febre aftosa conforme calendário oficial', via: 'Subcutânea' },
  { nome: 'Vacina Antirrábica dos Herbívoros', marca: null, especie: 'Bovinos', composicao: 'Vírus da raiva inativado', indicacao: 'Prevenção da raiva dos herbívoros (transmitida por morcegos)', via: 'Subcutânea' },
  { nome: 'Vacina Polivalente Clostridial', marca: null, especie: 'Bovinos', composicao: 'Clostridium spp. (carbúnculo sintomático, gangrena gasosa, enterotoxemia, botulismo, tétano)', indicacao: 'Prevenção das clostridioses em bovinos e ovinos', via: 'Subcutânea' },
  { nome: 'Sintoxan Polivalente', marca: 'Boehringer Ingelheim', especie: 'Bovinos', composicao: 'Clostridioses (múltiplos antígenos clostridiais)', indicacao: 'Prevenção das clostridioses', via: 'Subcutânea' },
  { nome: 'Vacina contra Brucelose B19', marca: null, especie: 'Bovinos', composicao: 'Brucella abortus amostra B19 (viva atenuada)', indicacao: 'Vacinação obrigatória de bezerras de 3 a 8 meses', via: 'Subcutânea' },
  { nome: 'Vacina contra Brucelose RB51', marca: null, especie: 'Bovinos', composicao: 'Brucella abortus amostra RB51 (viva, rugosa)', indicacao: 'Alternativa à B19; permite vacinação de fêmeas adultas conforme norma', via: 'Subcutânea' },
  { nome: 'Vacina contra IBR/BVD', marca: null, especie: 'Bovinos', composicao: 'Rinotraqueíte Infecciosa Bovina (IBR/BoHV-1) + Diarreia Viral Bovina (BVD)', indicacao: 'Prevenção de doenças reprodutivas e respiratórias em bovinos', via: 'Intramuscular' },
  { nome: 'Vacina contra Leptospirose Bovina', marca: null, especie: 'Bovinos', composicao: 'Leptospira spp. (múltiplos sorovares)', indicacao: 'Prevenção da leptospirose e perdas reprodutivas', via: 'Subcutânea' },
  { nome: 'Vacina contra Botulismo (bivalente C e D)', marca: null, especie: 'Bovinos', composicao: 'Toxóide de Clostridium botulinum tipos C e D', indicacao: 'Prevenção do botulismo em bovinos', via: 'Subcutânea' },
  { nome: 'Vacina contra Mastite (Startvac)', marca: 'Hipra', especie: 'Bovinos', composicao: 'E. coli J5 + Staphylococcus aureus (SP140)', indicacao: 'Redução da incidência e gravidade da mastite em vacas leiteiras', via: 'Intramuscular' },

  // ---------------- EQUINOS ----------------
  { nome: 'Vacina contra Influenza Equina + Tétano', marca: null, especie: 'Cavalo', composicao: 'Vírus influenza equina inativado + Toxóide tetânico', indicacao: 'Prevenção da gripe equina e do tétano', via: 'Intramuscular' },
  { nome: 'Vacina contra Encefalomielite Equina', marca: null, especie: 'Cavalo', composicao: 'Vírus da encefalomielite equina (Leste e Oeste) inativado', indicacao: 'Prevenção das encefalomielites equinas', via: 'Intramuscular' },
  { nome: 'Vacina Antirrábica Equina', marca: null, especie: 'Cavalo', composicao: 'Vírus da raiva inativado', indicacao: 'Prevenção da raiva em equinos', via: 'Intramuscular' },
  { nome: 'Vacina contra Tétano (Toxóide Tetânico)', marca: null, especie: 'Cavalo', composicao: 'Toxóide tetânico (Clostridium tetani)', indicacao: 'Prevenção do tétano em equinos', via: 'Intramuscular' },
];

function slug(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 55);
}

(async () => {
  console.log(`[seed-vacinas] inserindo ${VACINAS.length} vacinas curadas...`);
  let n = 0;
  try {
    for (const v of VACINAS) {
      await WebProdutosVeterinarios.upsert({
        fonte: 'curado',
        id_externo: 'vacina-' + slug(v.nome),
        nome: v.nome,
        marca: v.marca,
        especie: v.especie,
        categoria: 'Medicamentos',
        subcategoria: 'Vacina',
        principio_ativo: (v.composicao || '').slice(0, 500),
        indicacao: v.indicacao || null,
        apresentacao: null,
        via: v.via || null,
        porte: null,
        descricao: null,
        link: null,
        st_ativo: 1,
      });
      n++;
    }
  } finally {
    await sequelize.close().catch(() => {});
  }
  console.log(`[seed-vacinas] concluído: ${n} vacinas gravadas (fonte=curado, subcategoria=Vacina).`);
})().catch((e) => {
  console.error('[seed-vacinas] ERRO:', e && e.message);
  process.exit(1);
});
