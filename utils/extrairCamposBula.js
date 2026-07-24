'use strict';
/*
 * Extrai campos estruturados do TEXTO de uma bula (best-effort, por regex).
 * PURO: não depende de puppeteer/pdf-parse — pode ser usado nas rotas serverless
 * (Vercel) que apenas leem o cache. Retorna { concentracao, forma, via, posologia }.
 */

// --- Concentração + Forma farmacêutica (a partir da seção "APRESENTAÇÕES") ---
function extrairApresentacao(texto) {
  const t = String(texto || '');
  const m = t.match(/APRESENTA[ÇC][ÃA]O(?:ES|ÕES)?\s*[:\-]?\s*([\s\S]{0,400})/i);
  const trecho = m ? m[1] : t.slice(0, 400);
  const tl = trecho.toLowerCase();

  const FORMAS = [
    'solução oral', 'solução injetável', 'solução em gotas', 'solução (gotas)',
    'comprimido revestido', 'comprimido', 'cápsula', 'capsula', 'xarope',
    'suspensão oral', 'suspensão', 'pomada', 'creme', 'gel', 'aerossol',
    'spray', 'supositório', 'adesivo', 'gotas', 'solução',
  ];
  let forma = FORMAS.find((f) => tl.includes(f)) || '';
  if (forma) forma = forma.charAt(0).toUpperCase() + forma.slice(1);

  const c = trecho.match(
    /\d{1,4}(?:[.,]\d{1,3})?\s?(?:mg|mcg|µg|g|ui|UI)(?:\s?\/\s?\d{0,4}(?:[.,]\d{1,3})?\s?mL|\s?\+\s?\d{1,4}(?:[.,]\d{1,3})?\s?(?:mg|mcg|g))?/i
  );
  const concentracao = c ? c[0].replace(/\s+/g, ' ').trim() : '';

  return { concentracao, forma };
}

// --- Via de administração ---
const VIAS = [
  'oral', 'intravenosa', 'endovenosa', 'intramuscular', 'subcutânea', 'subcutanea',
  'tópica', 'topica', 'oftálmica', 'oftalmica', 'nasal', 'retal', 'inalatória',
  'inalatoria', 'vaginal', 'otológica', 'otologica', 'sublingual', 'transdérmica',
  'transdermica',
];
function capitalizar(s) {
  const v = String(s || '').trim().toLowerCase();
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : '';
}
function extrairVia(texto) {
  const t = String(texto || '');
  // 1) rótulo explícito "Via de administração: X"
  const lbl = t.match(/via\s+de\s+administra[çc][ãa]o\s*[:\-]?\s*([A-Za-zÀ-ú]{3,20})/i);
  if (lbl && VIAS.includes(lbl[1].toLowerCase())) return capitalizar(lbl[1]);
  // 2) "USO ORAL" / "VIA ORAL" / "USO INTRAVENOSO" (comum no topo da bula)
  const uso = t.match(
    /\b(?:uso|via)\s+(oral|intravenos[ao]|endovenos[ao]|intramuscular|subcut[âa]ne[ao]|t[óo]pic[ao]|oft[áa]lmic[ao]|nasal|retal|inalat[óo]ri[ao]|vaginal|sublingual|transd[ée]rmic[ao])\b/i
  );
  if (uso) {
    // normaliza para o feminino "via X"
    let v = uso[1].toLowerCase().replace(/o$/, 'a');
    return capitalizar(v);
  }
  return '';
}

// --- Posologia (bloco da seção "POSOLOGIA...") ---
// Casa só CABEÇALHO de seção (POSOLOGIA no início de linha, opc. numerada), para
// não pegar a palavra "posologia" solta no meio de uma frase (falso positivo).
function extrairPosologia(texto) {
  const t = String(texto || '');
  const patterns = [
    /(?:^|\n)\s*(?:\d{1,2}[.\)]\s*)?POSOLOGIA\s+E\s+MODO\s+DE\s+USAR[^\n]*\n+([\s\S]{20,2000})/i,
    /(?:^|\n)\s*\d{1,2}[.\)]\s*POSOLOGIA[^\n]*\n+([\s\S]{20,2000})/i,
    /(?:^|\n)\s*POSOLOGIA[^\n]{0,40}\n+([\s\S]{20,2000})/i,
  ];
  let bloco = '';
  for (const re of patterns) {
    const m = t.match(re);
    if (m) { bloco = m[1]; break; }
  }
  if (!bloco) return '';
  // corta no próximo cabeçalho de seção (numerado "9." ou linha toda em maiúsculas)
  const corte = bloco.search(/\n\s*(?:\d{1,2}\.\s+[A-ZÀ-Ú]|[A-ZÀ-Ú][A-ZÀ-Ú \-]{10,}\n)/);
  if (corte > 100) bloco = bloco.slice(0, corte);
  return bloco.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 1200);
}

function extrairCampos(texto) {
  const { concentracao, forma } = extrairApresentacao(texto);
  return {
    concentracao,
    forma,
    via: extrairVia(texto),
    posologia: extrairPosologia(texto),
  };
}

module.exports = { extrairCampos, extrairApresentacao, extrairVia, extrairPosologia };
